import { prisma } from "@ecommerce-x/db";
import { customAlphabet } from "nanoid";
import { HttpError } from "../../lib/http-error.js";
import { cartTotals, getCartById } from "../cart/cart.service.js";
import { deductStockAcrossLocations, getAvailableStock, restockToDefaultLocation } from "../inventory/inventory.service.js";
import { redeemPointsForOrder, maxRedeemablePoints, getLoyaltyRule } from "../loyalty/loyalty.service.js";
import { getSettingsGroup } from "../settings/settings.service.js";

const nanoid = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

export function generateOrderNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `ORD-${stamp}-${nanoid()}`;
}

async function getShippingFee(district: string | undefined, subtotal: number): Promise<number> {
  if (!district) return 0;
  const zones = await prisma.shippingZone.findMany({ where: { isActive: true }, include: { rates: { where: { isActive: true } } } });
  const matched = zones.find((z) => z.districts.includes(district)) ?? zones.find((z) => z.districts.length === 0);
  const rate = matched?.rates[0];
  if (!rate) return 0;
  if (rate.freeAboveSpend && subtotal >= Number(rate.freeAboveSpend)) return 0;
  return Number(rate.price);
}

interface CheckoutInput {
  cartId: string;
  userId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  customerNote?: string;
  redeemPoints?: number;
  gateway: "ESEWA" | "FONEPAY" | "CYBERSOURCE_NICASIA" | "COD";
}

export async function createOrderFromCart(input: CheckoutInput) {
  const cart = await getCartById(input.cartId);
  if (!cart || cart.items.length === 0) throw HttpError.badRequest("Cart is empty");

  const payments = await getSettingsGroup("payments");
  const gatewayCfg = payments[input.gateway.toLowerCase() === "cybersource_nicasia" ? "cybersource_nicasia" : input.gateway.toLowerCase()] as
    | { enabled?: boolean }
    | undefined;
  if (!gatewayCfg?.enabled) throw HttpError.badRequest(`${input.gateway} is not currently available`);

  // Validate stock for every item before committing.
  for (const item of cart.items) {
    const available = await getAvailableStock(item.variantId);
    if (item.quantity > available) {
      throw HttpError.badRequest(`"${item.product.name}" only has ${available} left in stock`);
    }
  }

  const { subtotal, discount } = cartTotals(cart);
  const district = (input.shippingAddress?.district as string) ?? undefined;
  const shippingTotal = await getShippingFee(district, subtotal);

  const taxRates = await prisma.product.findMany({
    where: { id: { in: cart.items.map((i) => i.productId) } },
    select: { id: true, taxable: true, taxRate: { select: { rate: true } } },
  });
  const taxByProduct = new Map(taxRates.map((p) => [p.id, p.taxable ? Number(p.taxRate?.rate ?? 0) : 0]));
  const taxTotal = cart.items.reduce((sum, item) => {
    const rate = taxByProduct.get(item.productId) ?? 0;
    const lineTotal = Number(item.variant.price) * item.quantity;
    return sum + (lineTotal * rate) / 100;
  }, 0);

  let loyaltyDiscount = 0;
  let pointsToRedeem = 0;
  if (input.userId && input.redeemPoints && input.redeemPoints > 0) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
    const rule = await getLoyaltyRule();
    pointsToRedeem = Math.min(input.redeemPoints, maxRedeemablePoints(subtotal - discount, user.loyaltyPoints, rule));
    loyaltyDiscount = pointsToRedeem * Number(rule.redeemPointValue);
  }

  const total = Math.max(0, subtotal - discount + taxTotal + shippingTotal - loyaltyDiscount);
  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        channel: "ONLINE",
        userId: input.userId,
        status: "PENDING",
        paymentStatus: "PENDING",
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        shippingAddress: input.shippingAddress as object,
        billingAddress: (input.billingAddress ?? input.shippingAddress) as object,
        subtotal,
        discountTotal: discount,
        taxTotal,
        shippingTotal,
        loyaltyDiscount,
        total,
        couponId: cart.couponId,
        loyaltyPointsRedeemed: pointsToRedeem,
        customerNote: input.customerNote,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.product.name,
            variantName: item.variant.name,
            sku: item.variant.sku,
            imageUrl: item.product.images[0]?.url,
            unitPrice: item.variant.price,
            quantity: item.quantity,
            total: Number(item.variant.price) * item.quantity,
          })),
        },
        statusHistory: { create: { status: "PENDING", note: "Order placed" } },
      },
      include: { items: true },
    });

    // Deduct stock from the connected pool (across every location) so an
    // online sale and an in-store POS sale of the same variant always draw
    // from the same real total.
    for (const item of created.items) {
      await deductStockAcrossLocations(
        { variantId: item.variantId, quantity: item.quantity, reason: "ONLINE_SALE", reference: created.orderNumber },
        tx
      );
    }

    if (pointsToRedeem > 0 && input.userId) {
      await redeemPointsForOrder(tx, input.userId, created.id, pointsToRedeem);
    }

    if (cart.couponId) {
      await tx.coupon.update({ where: { id: cart.couponId }, data: { usageCount: { increment: 1 } } });
    }

    // Clear the cart now that the order has been placed.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } });

    return created;
  });

  return order;
}

export async function restockOrder(orderId: string, reason: "RETURN" | "ADJUSTMENT" = "ADJUSTMENT") {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const item of order.items) {
    await restockToDefaultLocation({ variantId: item.variantId, quantity: item.quantity, reason, reference: order.orderNumber });
  }
}
