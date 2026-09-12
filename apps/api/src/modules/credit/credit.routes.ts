import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, POS_ROLES, ADMIN_ROLES } from "../../middleware/auth.js";
import { logAudit } from "../../lib/audit-log.js";
import { getCreditAccount, recordCreditPayment, setCreditLimit } from "./credit.service.js";

export const creditRouter = Router();
creditRouter.use(requireAuth, requireRole(...POS_ROLES));

// ---- Account summary + ledger (POS needs this to show a customer's tab) ----
creditRouter.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const userId = req.params.userId as string;
    const [account, transactions] = await Promise.all([
      getCreditAccount(userId),
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, type: true, amount: true, note: true, createdAt: true, order: { select: { orderNumber: true } } },
      }),
    ]);
    res.json({ ...account, transactions });
  })
);

// ---- Set/change a customer's credit limit — a trust decision, admin-only ----
const limitSchema = z.object({ creditLimit: z.number().min(0) });

creditRouter.put(
  "/:userId/limit",
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { creditLimit } = limitSchema.parse(req.body);
    const account = await setCreditLimit(req.params.userId as string, creditLimit);
    await logAudit({ userId: req.user!.id, action: "credit.limit.set", entityType: "User", entityId: req.params.userId, metadata: { creditLimit } });
    res.json(account);
  })
);

// ---- Record a payment against the balance — cashiers can take this when a customer pays down their tab ----
const paymentSchema = z.object({ amount: z.number().positive(), note: z.string().optional() });

creditRouter.post(
  "/:userId/payment",
  asyncHandler(async (req, res) => {
    const { amount, note } = paymentSchema.parse(req.body);
    const account = await recordCreditPayment(req.params.userId as string, amount, note);
    await logAudit({ userId: req.user!.id, action: "credit.payment.recorded", entityType: "User", entityId: req.params.userId, metadata: { amount, note } });
    res.json(account);
  })
);
