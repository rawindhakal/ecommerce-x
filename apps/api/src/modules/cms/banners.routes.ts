import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";

export const bannersRouter = Router();

bannersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const placement = req.query.placement as string | undefined;
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        placement: placement as any,
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { sortOrder: "asc" },
    });
    res.json(banners);
  })
);

bannersRouter.get(
  "/admin",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    res.json(await prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] }));
  })
);

const bannerSchema = z.object({
  title: z.string().min(1),
  imageUrl: z.string().min(1),
  mobileImageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  placement: z.enum(["HOME_HERO", "HOME_PROMO", "CATEGORY_TOP", "POPUP"]),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

bannersRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = bannerSchema.parse(req.body);
    const banner = await prisma.banner.create({
      data: { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : null, endsAt: data.endsAt ? new Date(data.endsAt) : null },
    });
    res.status(201).json(banner);
  })
);

bannersRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = bannerSchema.partial().parse(req.body);
    const banner = await prisma.banner.update({
      where: { id: req.params.id as string },
      data: { ...data, startsAt: data.startsAt ? new Date(data.startsAt) : undefined, endsAt: data.endsAt ? new Date(data.endsAt) : undefined },
    });
    res.json(banner);
  })
);

bannersRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.banner.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);
