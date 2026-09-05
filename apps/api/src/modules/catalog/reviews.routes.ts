import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { getPagination, paginate } from "../../lib/pagination.js";

export const reviewsRouter = Router();

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  comment: z.string().optional(),
  images: z.array(z.string()).optional(),
});

reviewsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = reviewSchema.parse(req.body);
    const verifiedPurchase = !!(await prisma.orderItem.findFirst({
      where: { productId: data.productId, order: { userId: req.user!.id, status: { in: ["DELIVERED", "COMPLETED"] } } },
    }));

    const review = await prisma.review.create({
      data: { ...data, userId: req.user!.id, verifiedPurchase, status: "PENDING" },
    });
    res.status(201).json(review);
  })
);

reviewsRouter.get(
  "/admin",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as any } : {};
    const [items, total] = await Promise.all([
      prisma.review.findMany({ where, include: { product: { select: { name: true, slug: true } }, user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.review.count({ where }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

async function recalcRating(productId: string) {
  const agg = await prisma.review.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: true });
  await prisma.product.update({ where: { id: productId }, data: { avgRating: agg._avg.rating ?? 0, reviewCount: agg._count } });
}

reviewsRouter.put(
  "/:id/status",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const status = z.enum(["PENDING", "APPROVED", "REJECTED"]).parse(req.body.status);
    const review = await prisma.review.update({ where: { id: req.params.id as string }, data: { status } });
    await recalcRating(review.productId);
    res.json(review);
  })
);

reviewsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.findUnique({ where: { id: req.params.id as string } });
    if (!review) throw HttpError.notFound("Review not found");
    await prisma.review.delete({ where: { id: review.id } });
    await recalcRating(review.productId);
    res.json({ success: true });
  })
);
