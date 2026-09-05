import { prisma } from "@ecommerce-x/db";
import type { Request } from "express";

const cartInclude = {
  items: { include: { product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" as const } } } }, variant: true } },
  coupon: true,
};

// Upsert-based (not find-then-create) so concurrent requests for the same
// user/session can't race into a duplicate-key error on the unique column.
export async function getOrCreateCart(req: Request) {
  if (req.user) {
    const userId = req.user.id;
    await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    return prisma.cart.findUniqueOrThrow({ where: { userId }, include: cartInclude });
  }

  const sessionId = req.headers["x-cart-session"] as string | undefined;
  if (!sessionId) throw new Error("Missing x-cart-session header for guest cart");

  await prisma.cart.upsert({ where: { sessionId }, update: {}, create: { sessionId } });
  return prisma.cart.findUniqueOrThrow({ where: { sessionId }, include: cartInclude });
}

export async function getCartById(id: string) {
  return prisma.cart.findUnique({ where: { id }, include: cartInclude });
}

export function cartTotals(cart: NonNullable<Awaited<ReturnType<typeof getCartById>>>) {
  const subtotal = cart.items.reduce((sum, i) => sum + Number(i.variant.price) * i.quantity, 0);
  let discount = 0;
  if (cart.coupon) {
    if (cart.coupon.type === "PERCENTAGE") discount = (subtotal * Number(cart.coupon.value)) / 100;
    else if (cart.coupon.type === "FIXED_AMOUNT") discount = Number(cart.coupon.value);
    if (cart.coupon.maxDiscount) discount = Math.min(discount, Number(cart.coupon.maxDiscount));
    discount = Math.min(discount, subtotal);
  }
  return { subtotal, discount, total: subtotal - discount };
}
