import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, POS_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { deductStockAcrossLocations, getAvailableStock } from "../inventory/inventory.service.js";
import { generateOrderNumber } from "../orders/orders.service.js";
import { earnPointsForOrder, redeemPointsForOrder, maxRedeemablePoints, getLoyaltyRule } from "../loyalty/loyalty.service.js";

export const posRouter = Router();
posRouter.use(requireAuth, requireRole(...POS_ROLES));

// ---- Barcode / SKU exact lookup (scanner input) ----
posRouter.get(
  "/lookup/:code",
  asyncHandler(async (req, res) => {
    const code = req.params.code as string;
    const variant = await prisma.productVariant.findFirst({
      where: { OR: [{ barcode: code }, { sku: code }], isActive: true },
      include: { product: { include: { images: { take: 1 }, taxRate: true } }, inventory: true },
    });
    if (!variant) throw HttpError.notFound("Product not found for this barcode/SKU");
    res.json(variant);
  })
);

// ---- Live search by product name or variant (shade/size/color/name).
// With no query, returns a browsable "menu" grid of active products instead
// of an empty result, so the POS terminal always has something to show.
posRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();

    const variants = await prisma.productVariant.findMany({
      where: {
        isActive: true,
        ...(q.length >= 2
          ? {
              OR: [
                { sku: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { product: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } }, taxRate: true } }, inventory: true },
      take: q.length >= 2 ? 25 : 40,
      orderBy: { product: { name: "asc" } },
    });
    res.json(variants);
  })
);

// ---- Customers: search by phone, or create a walk-in ----
posRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone ?? "").trim();
    if (phone.length < 3) return res.json([]);
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER", phone: { contains: phone } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, loyaltyPoints: true },
      take: 10,
    });
    res.json(customers);
  })
);

const createCustomerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().min(6),
});

posRouter.post(
  "/customers",
  asyncHandler(async (req, res) => {
    const data = createCustomerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw HttpError.conflict("A customer with this phone number already exists");

    const customer = await prisma.user.create({
      data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone, role: "CUSTOMER" },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, loyaltyPoints: true },
    });
    res.status(201).json(customer);
  })
);

// ---- Session management ----
const openSessionSchema = z.object({ locationId: z.string(), openingBalance: z.number().nonnegative() });

posRouter.post(
  "/sessions/open",
  asyncHandler(async (req, res) => {
    const data = openSessionSchema.parse(req.body);
    const existing = await prisma.posSession.findFirst({ where: { cashierId: req.user!.id, closedAt: null } });
    if (existing) throw HttpError.conflict("You already have an open POS session");

    const session = await prisma.posSession.create({
      data: { locationId: data.locationId, cashierId: req.user!.id, openingBalance: data.openingBalance },
      include: { location: true },
    });
    res.status(201).json(session);
  })
);

posRouter.get(
  "/sessions/current",
  asyncHandler(async (req, res) => {
    const session = await prisma.posSession.findFirst({ where: { cashierId: req.user!.id, closedAt: null }, include: { location: true } });
    res.json(session);
  })
);

// Live pre-close report: opening balance, sales by payment method, expected cash balance.
posRouter.get(
  "/sessions/:id/summary",
  asyncHandler(async (req, res) => {
    const session = await prisma.posSession.findUniqueOrThrow({ where: { id: req.params.id as string }, include: { location: true, cashier: { select: { firstName: true, lastName: true } } } });

    const orders = await prisma.order.findMany({
      where: { channel: "POS", locationId: session.locationId, createdAt: { gte: session.openedAt, ...(session.closedAt ? { lte: session.closedAt } : {}) } },
      include: { payments: true },
    });

    const byMethod: Record<string, { count: number; total: number }> = {};
    let cashTotal = 0;
    for (const order of orders) {
      for (const payment of order.payments) {
        if (payment.status !== "PAID") continue;
        byMethod[payment.gateway] ??= { count: 0, total: 0 };
        byMethod[payment.gateway]!.count += 1;
        byMethod[payment.gateway]!.total += Number(payment.amount);
        if (payment.gateway === "CASH") cashTotal += Number(payment.amount);
      }
    }

    res.json({
      session,
      orderCount: orders.length,
      byMethod,
      cashSalesTotal: cashTotal,
      expectedCashBalance: Number(session.openingBalance) + cashTotal,
    });
  })
);

const closeSessionSchema = z.object({ closingBalance: z.number().nonnegative(), note: z.string().optional() });

posRouter.put(
  "/sessions/:id/close",
  asyncHandler(async (req, res) => {
    const { closingBalance, note } = closeSessionSchema.parse(req.body);
    const session = await prisma.posSession.findUniqueOrThrow({ where: { id: req.params.id as string } });

    const cashOrders = await prisma.order.findMany({
      where: { channel: "POS", locationId: session.locationId, createdAt: { gte: session.openedAt }, payments: { some: { gateway: "CASH", status: "PAID" } } },
      include: { payments: true },
    });
    const cashSalesTotal = cashOrders.reduce((sum, o) => sum + o.payments.filter((p) => p.gateway === "CASH" && p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0), 0);
    const expectedBalance = Number(session.openingBalance) + cashSalesTotal;

    const updated = await prisma.posSession.update({
      where: { id: session.id },
      data: { closingBalance, expectedBalance, closedAt: new Date(), note },
    });
    res.json({ ...updated, variance: closingBalance - expectedBalance });
  })
);

// ---- POS Sale ----
const saleItemSchema = z.object({ variantId: z.string(), quantity: z.number().int().min(1) });
const saleSchema = z.object({
  locationId: z.string(),
  items: z.array(saleItemSchema).min(1),
  customerId: z.string().optional(),
  customerName: z.string().default("Walk-in Customer"),
  customerPhone: z.string().optional(),
  paymentMethod: z.enum(["CASH", "CARD_POS", "FONEPAY", "ESEWA"]),
  amountTendered: z.number().optional(),
  discountTotal: z.number().nonnegative().default(0),
  redeemPoints: z.number().int().nonnegative().optional(),
});

posRouter.post(
  "/sale",
  asyncHandler(async (req, res) => {
    const data = saleSchema.parse(req.body);

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: data.items.map((i) => i.variantId) } },
      include: { product: { include: { taxRate: true } } },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Availability is checked against the connected total across all
    // locations, matching what the storefront shows as "in stock" — not
    // just this store's own count.
    for (const item of data.items) {
      const available = await getAvailableStock(item.variantId);
      if (item.quantity > available) {
        throw HttpError.badRequest(`"${variantMap.get(item.variantId)?.product.name}" only has ${available} left in stock`);
      }
    }

    const subtotal = data.items.reduce((sum, item) => {
      const v = variantMap.get(item.variantId)!;
      return sum + Number(v.price) * item.quantity;
    }, 0);

    // Same tax logic as the online checkout: each item is taxed at its
    // product's configured rate (or 0 if not taxable / no rate set).
    const taxTotal = data.items.reduce((sum, item) => {
      const v = variantMap.get(item.variantId)!;
      const rate = v.product.taxable ? Number(v.product.taxRate?.rate ?? 0) : 0;
      return sum + (Number(v.price) * item.quantity * rate) / 100;
    }, 0);

    let loyaltyDiscount = 0;
    if (data.customerId && data.redeemPoints) {
      const user = await prisma.user.findUnique({ where: { id: data.customerId } });
      if (user) {
        const rule = await getLoyaltyRule();
        const points = Math.min(data.redeemPoints, maxRedeemablePoints(subtotal, user.loyaltyPoints, rule));
        loyaltyDiscount = points * Number(rule.redeemPointValue);
        data.redeemPoints = points;
      }
    }

    const total = Math.max(0, subtotal - data.discountTotal + taxTotal - loyaltyDiscount);
    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          channel: "POS",
          userId: data.customerId,
          locationId: data.locationId,
          status: "COMPLETED",
          paymentStatus: "PAID",
          fulfillmentStatus: "FULFILLED",
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          subtotal,
          discountTotal: data.discountTotal,
          taxTotal,
          loyaltyDiscount,
          total,
          loyaltyPointsRedeemed: data.redeemPoints ?? 0,
          items: {
            create: data.items.map((item) => {
              const v = variantMap.get(item.variantId)!;
              return {
                productId: v.productId,
                variantId: v.id,
                name: v.product.name,
                variantName: v.name,
                sku: v.sku,
                unitPrice: v.price,
                quantity: item.quantity,
                total: Number(v.price) * item.quantity,
              };
            }),
          },
          statusHistory: { create: { status: "COMPLETED", note: "POS sale" } },
          payments: {
            create: {
              gateway: data.paymentMethod,
              status: "PAID",
              amount: total,
              referenceId: `POS-${orderNumber}`,
              paidAt: new Date(),
            },
          },
        },
        include: { items: true, payments: true },
      });

      for (const item of data.items) {
        await deductStockAcrossLocations(
          { variantId: item.variantId, quantity: item.quantity, reason: "POS_SALE", reference: orderNumber, performedById: req.user!.id },
          tx
        );
      }

      let pointsEarned = 0;
      if (data.customerId) {
        if (data.redeemPoints) {
          await redeemPointsForOrder(tx, data.customerId, created.id, data.redeemPoints);
        }
        pointsEarned = await earnPointsForOrder(tx, data.customerId, created.id, total);
      }

      return { ...created, loyaltyPointsEarnedNow: pointsEarned };
    });

    res.status(201).json({ order, change: data.amountTendered ? Math.max(0, data.amountTendered - total) : undefined });
  })
);

posRouter.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const sales = await prisma.order.findMany({
      where: { channel: "POS" },
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(sales);
  })
);
