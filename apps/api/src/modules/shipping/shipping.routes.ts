import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";

export const shippingRouter = Router();

shippingRouter.get(
  "/zones",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.shippingZone.findMany({ include: { rates: true }, orderBy: { name: "asc" } }));
  })
);

const zoneSchema = z.object({ name: z.string().min(1), districts: z.array(z.string()).default([]), isActive: z.boolean().optional() });

shippingRouter.post(
  "/zones",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const zone = await prisma.shippingZone.create({ data: zoneSchema.parse(req.body) });
    res.status(201).json(zone);
  })
);

shippingRouter.put(
  "/zones/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const zone = await prisma.shippingZone.update({ where: { id: req.params.id as string }, data: zoneSchema.partial().parse(req.body) });
    res.json(zone);
  })
);

shippingRouter.delete(
  "/zones/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.shippingZone.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);

const rateSchema = z.object({
  zoneId: z.string(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  freeAboveSpend: z.number().nonnegative().optional(),
  codAvailable: z.boolean().optional(),
  estimatedDays: z.string().optional(),
  isActive: z.boolean().optional(),
});

shippingRouter.post(
  "/rates",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const rate = await prisma.shippingRate.create({ data: rateSchema.parse(req.body) });
    res.status(201).json(rate);
  })
);

shippingRouter.put(
  "/rates/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const rate = await prisma.shippingRate.update({ where: { id: req.params.id as string }, data: rateSchema.partial().parse(req.body) });
    res.json(rate);
  })
);

shippingRouter.delete(
  "/rates/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.shippingRate.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);

// ---- Tax rates ----
export const taxRouter = Router();

taxRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.taxRate.findMany({ orderBy: { name: "asc" } }));
  })
);

const taxSchema = z.object({ name: z.string().min(1), rate: z.number().min(0).max(100), isDefault: z.boolean().optional() });

taxRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const tax = await prisma.taxRate.create({ data: taxSchema.parse(req.body) });
    res.status(201).json(tax);
  })
);

taxRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const tax = await prisma.taxRate.update({ where: { id: req.params.id as string }, data: taxSchema.partial().parse(req.body) });
    res.json(tax);
  })
);
