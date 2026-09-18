import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { generateUniqueSlug } from "../../lib/unique-slug.js";

export const brandsRouter = Router();

brandsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const brands = await prisma.brand.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(brands);
  })
);

brandsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({ where: { slug: req.params.slug as string } });
    if (!brand) throw HttpError.notFound("Brand not found");
    res.json(brand);
  })
);

const brandSchema = z.object({
  name: z.string().min(1),
  // slug is auto-generated from name server-side, same as Product — not
  // accepted from the client (see generateUniqueSlug).
  // .nullish() (not just .optional()) because the admin edit form spreads
  // the full brand record — including already-null DB fields — back into
  // the update payload; a plain .optional() rejects an explicit `null`.
  description: z.string().nullish(),
  logoUrl: z.string().nullish(),
  isActive: z.boolean().optional(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
});

brandsRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = brandSchema.parse(req.body);
    const slug = await generateUniqueSlug(data.name, (s) => prisma.brand.findUnique({ where: { slug: s }, select: { id: true } }).then(Boolean), "brand");
    const brand = await prisma.brand.create({ data: { ...data, slug } });
    res.status(201).json(brand);
  })
);

brandsRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.update({ where: { id: req.params.id as string }, data: brandSchema.partial().parse(req.body) });
    res.json(brand);
  })
);

brandsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.brand.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);
