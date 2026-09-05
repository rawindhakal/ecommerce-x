import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { getPagination, paginate } from "../../lib/pagination.js";

export const couponsRouter = Router();
couponsRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

couponsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const [items, total] = await Promise.all([
      prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      prisma.coupon.count(),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

const couponSchema = z.object({
  code: z.string().min(3).transform((s) => s.toUpperCase()),
  description: z.string().optional(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  value: z.number().nonnegative(),
  minSpend: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().optional(),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

couponsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = couponSchema.parse(req.body);
    const coupon = await prisma.coupon.create({
      data: { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : undefined, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined },
    });
    res.status(201).json(coupon);
  })
);

couponsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = couponSchema.partial().parse(req.body);
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id as string },
      data: { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : undefined, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined },
    });
    res.json(coupon);
  })
);

couponsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.coupon.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);
