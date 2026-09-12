import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

wishlistRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      include: {
        product: {
          include: {
            images: { take: 1, orderBy: { sortOrder: "asc" } },
            variants: { where: { isActive: true }, take: 1, orderBy: { createdAt: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  })
);

wishlistRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      update: {},
      create: { userId: req.user!.id, productId },
    });
    res.status(201).json(item);
  })
);

wishlistRouter.delete(
  "/:productId",
  asyncHandler(async (req, res) => {
    await prisma.wishlistItem.deleteMany({ where: { userId: req.user!.id, productId: req.params.productId as string } });
    res.json({ success: true });
  })
);
