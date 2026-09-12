import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { optionalAuth, requireAuth, requireRole, STAFF_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { getPagination, paginate } from "../../lib/pagination.js";
import { getOrCreateCart } from "../cart/cart.service.js";
import { createOrderFromCart, restockOrder } from "./orders.service.js";
import { getGateway } from "../../payments/index.js";
import { customAlphabet } from "nanoid";
import { env } from "../../config/env.js";
import { PHONE_REGEX, PHONE_VALIDATION_MESSAGE } from "@ecommerce-x/shared";

export const ordersRouter = Router();
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const addressSchema = z.object({
  fullName: z.string(),
  phone: z.string().regex(PHONE_REGEX, PHONE_VALIDATION_MESSAGE),
  province: z.string(),
  district: z.string(),
  municipality: z.string(),
  ward: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().optional(),
});

const checkoutSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().regex(PHONE_REGEX, PHONE_VALIDATION_MESSAGE),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  customerNote: z.string().optional(),
  redeemPoints: z.number().int().nonnegative().optional(),
  gateway: z.enum(["ESEWA", "FONEPAY", "CYBERSOURCE_NICASIA", "COD"]),
});

ordersRouter.post(
  "/checkout",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const data = checkoutSchema.parse(req.body);
    const cart = await getOrCreateCart(req);

    const order = await createOrderFromCart({
      cartId: cart.id,
      userId: req.user?.id,
      ...data,
    });

    const referenceId = `${order.orderNumber}-${nanoid(6)}`;
    const successUrl = `${env.apiUrl}/api/payments/callback/${data.gateway.toLowerCase()}?orderId=${order.id}`;
    const failureUrl = `${env.webUrl}/checkout/failed?orderId=${order.id}`;

    const gatewayImpl = getGateway(data.gateway);
    const initiateResult = await gatewayImpl.initiate({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
      },
      referenceId,
      successUrl,
      failureUrl,
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: data.gateway,
        status: "PENDING",
        amount: order.total,
        currency: order.currency,
        referenceId,
        rawRequest: (initiateResult.formFields ?? {}) as object,
        isTestMode: env.nodeEnv !== "production",
      },
    });

    if (data.gateway === "COD") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } });
      await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    }

    res.status(201).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      payment: initiateResult,
    });
  })
);

ordersRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: req.user!.id },
        include: { items: true, payments: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where: { userId: req.user!.id } }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

ordersRouter.get(
  "/admin",
  requireAuth,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const { status, channel, search } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (search) where.OR = [{ orderNumber: { contains: search, mode: "insensitive" } }, { customerName: { contains: search, mode: "insensitive" } }, { customerPhone: { contains: search } }];

    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, include: { items: true, payments: true }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.order.count({ where }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

ordersRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id as string },
      include: { items: true, payments: true, statusHistory: { orderBy: { createdAt: "asc" } } },
    });
    if (!order) throw HttpError.notFound("Order not found");
    // Guest orders (no userId) stay viewable without auth so the post-checkout
    // confirmation/tracking page works without an account. A registered
    // customer's order, though, must only be visible to its owner or staff —
    // previously this only blocked a *logged-in* customer who wasn't the
    // owner, so simply not sending auth cookies bypassed the check entirely.
    if (order.userId) {
      const isOwner = req.user?.id === order.userId;
      const isStaff = req.user?.role && STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number]);
      if (!isOwner && !isStaff) throw HttpError.forbidden();
    }
    res.json(order);
  })
);

const statusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"]),
  note: z.string().optional(),
});

ordersRouter.put(
  "/:id/status",
  requireAuth,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const { status, note } = statusSchema.parse(req.body);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: req.params.id as string } });

    if ((status === "CANCELLED" || status === "REFUNDED") && order.status !== "CANCELLED" && order.status !== "REFUNDED") {
      await restockOrder(order.id, status === "REFUNDED" ? "RETURN" : "ADJUSTMENT");
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        fulfillmentStatus: status === "SHIPPED" || status === "DELIVERED" || status === "COMPLETED" ? "FULFILLED" : undefined,
        statusHistory: { create: { status, note } },
      },
    });
    res.json(updated);
  })
);
