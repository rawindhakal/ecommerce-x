import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { getLoyaltyRule } from "./loyalty.service.js";

export const loyaltyRouter = Router();

loyaltyRouter.get(
  "/rules",
  asyncHandler(async (_req, res) => {
    res.json(await getLoyaltyRule());
  })
);

const ruleSchema = z.object({
  isActive: z.boolean().optional(),
  earnPointsPerNpr: z.number().nonnegative().optional(),
  redeemPointValue: z.number().positive().optional(),
  minRedeemPoints: z.number().int().nonnegative().optional(),
  maxRedeemPercent: z.number().min(0).max(100).optional(),
  pointsExpireDays: z.number().int().nullable().optional(),
});

loyaltyRouter.put(
  "/rules",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = ruleSchema.parse(req.body);
    const existing = await prisma.loyaltyRule.findFirst();
    const rule = existing
      ? await prisma.loyaltyRule.update({ where: { id: existing.id }, data })
      : await prisma.loyaltyRule.create({ data });
    res.json(rule);
  })
);

loyaltyRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [user, txns] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { loyaltyPoints: true } }),
      prisma.loyaltyTransaction.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    res.json({ balance: user?.loyaltyPoints ?? 0, transactions: txns });
  })
);

loyaltyRouter.get(
  "/customers/:userId",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const [user, txns] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.params.userId as string }, select: { loyaltyPoints: true } }),
      prisma.loyaltyTransaction.findMany({ where: { userId: req.params.userId as string }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    res.json({ balance: user?.loyaltyPoints ?? 0, transactions: txns });
  })
);

const adjustSchema = z.object({ userId: z.string(), points: z.number().int(), note: z.string().optional() });

loyaltyRouter.post(
  "/adjust",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { userId, points, note } = adjustSchema.parse(req.body);
    await prisma.$transaction([
      prisma.loyaltyTransaction.create({ data: { userId, type: "ADJUST", points, note: note ?? "Manual adjustment" } }),
      prisma.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } }),
    ]);
    res.json({ success: true });
  })
);
