import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { PHONE_REGEX, PHONE_VALIDATION_MESSAGE } from "@ecommerce-x/shared";

export const addressesRouter = Router();
addressesRouter.use(requireAuth);

addressesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { isDefault: "desc" } }));
  })
);

const addressSchema = z.object({
  label: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().regex(PHONE_REGEX, PHONE_VALIDATION_MESSAGE),
  province: z.string().min(1),
  district: z.string().min(1),
  municipality: z.string().min(1),
  ward: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().optional(),
  isDefault: z.boolean().optional(),
});

addressesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = addressSchema.parse(req.body);
    if (data.isDefault) await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    const address = await prisma.address.create({ data: { ...data, userId: req.user!.id } });
    res.status(201).json(address);
  })
);

addressesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.userId !== req.user!.id) throw HttpError.notFound("Address not found");
    const data = addressSchema.partial().parse(req.body);
    if (data.isDefault) await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    const address = await prisma.address.update({ where: { id: existing.id }, data });
    res.json(address);
  })
);

addressesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.userId !== req.user!.id) throw HttpError.notFound("Address not found");
    await prisma.address.delete({ where: { id: existing.id } });
    res.json({ success: true });
  })
);
