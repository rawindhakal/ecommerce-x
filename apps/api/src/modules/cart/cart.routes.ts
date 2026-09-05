import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { optionalAuth } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { getOrCreateCart, cartTotals } from "./cart.service.js";
import { getAvailableStock } from "../inventory/inventory.service.js";

export const cartRouter = Router();
cartRouter.use(optionalAuth);

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req);
    res.json({ ...cart, totals: cartTotals(cart) });
  })
);

const addItemSchema = z.object({ variantId: z.string(), quantity: z.number().int().min(1).default(1) });

cartRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const { variantId, quantity } = addItemSchema.parse(req.body);
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || !variant.isActive) throw HttpError.notFound("Product variant not found");

    const available = await getAvailableStock(variantId);
    const cart = await getOrCreateCart(req);
    const existing = cart.items.find((i) => i.variantId === variantId);
    const desiredQty = (existing?.quantity ?? 0) + quantity;
    if (desiredQty > available) throw HttpError.badRequest(`Only ${available} left in stock`);

    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: desiredQty } });
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, productId: variant.productId, variantId, quantity } });
    }

    const updated = await getOrCreateCart(req);
    res.status(201).json({ ...updated, totals: cartTotals(updated) });
  })
);

const updateItemSchema = z.object({ quantity: z.number().int().min(0) });

cartRouter.put(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const { quantity } = updateItemSchema.parse(req.body);
    const cart = await getOrCreateCart(req);
    const item = cart.items.find((i) => i.id === req.params.itemId);
    if (!item) throw HttpError.notFound("Cart item not found");

    if (quantity === 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const available = await getAvailableStock(item.variantId);
      if (quantity > available) throw HttpError.badRequest(`Only ${available} left in stock`);
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    }

    const updated = await getOrCreateCart(req);
    res.json({ ...updated, totals: cartTotals(updated) });
  })
);

cartRouter.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req);
    await prisma.cartItem.deleteMany({ where: { id: req.params.itemId as string, cartId: cart.id } });
    const updated = await getOrCreateCart(req);
    res.json({ ...updated, totals: cartTotals(updated) });
  })
);

const couponSchema = z.object({ code: z.string().min(1) });

cartRouter.post(
  "/coupon",
  asyncHandler(async (req, res) => {
    const { code } = couponSchema.parse(req.body);
    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon || !coupon.isActive) throw HttpError.badRequest("Invalid coupon code");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw HttpError.badRequest("Coupon has expired");
    if (coupon.startsAt && coupon.startsAt > new Date()) throw HttpError.badRequest("Coupon is not active yet");
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw HttpError.badRequest("Coupon usage limit reached");

    const cart = await getOrCreateCart(req);
    const { subtotal } = cartTotals({ ...cart, coupon: null });
    if (coupon.minSpend && subtotal < Number(coupon.minSpend)) {
      throw HttpError.badRequest(`Minimum spend of NPR ${coupon.minSpend} required for this coupon`);
    }

    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
    const updated = await getOrCreateCart(req);
    res.json({ ...updated, totals: cartTotals(updated) });
  })
);

cartRouter.delete(
  "/coupon",
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req);
    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    const updated = await getOrCreateCart(req);
    res.json({ ...updated, totals: cartTotals(updated) });
  })
);
