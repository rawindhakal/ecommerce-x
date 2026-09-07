import { Router } from "express";
import { z } from "zod";
import express from "express";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { getGateway } from "../../payments/index.js";
import { finalizeSuccessfulPayment, finalizeFailedPayment } from "../orders/payment-finalize.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";

export const paymentsRouter = Router();

async function findPaymentForOrder(orderId: string) {
  const payment = await prisma.payment.findFirst({ where: { orderId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (!payment) throw HttpError.notFound("No pending payment found for this order");
  return payment;
}

// A validly-signed callback proves the gateway processed *some* payment —
// not that it's the one for THIS orderId, which comes straight from an
// attacker-controlled query param. Without re-checking the gateway's own
// echoed transaction reference (and amount) against the pending payment we
// looked up, a real signed callback from a legitimate small purchase could
// be replayed with a different orderId to mark an unrelated, more expensive
// order as paid. Every callback must pass through this before finalizing.
function assertResultMatchesPayment(result: { referenceId?: string; amount?: number }, payment: { referenceId: string; amount: unknown }) {
  if (!result.referenceId || result.referenceId !== payment.referenceId) {
    throw HttpError.badRequest("Payment reference mismatch — this callback does not belong to the pending payment for this order");
  }
  if (result.amount !== undefined && Math.abs(result.amount - Number(payment.amount)) > 0.01) {
    throw HttpError.badRequest("Payment amount mismatch — this callback does not belong to the pending payment for this order");
  }
}

// ---- eSewa: browser GET redirect with base64 `data` param ----
paymentsRouter.get(
  "/callback/esewa",
  asyncHandler(async (req, res) => {
    const orderId = req.query.orderId as string;
    const payment = await findPaymentForOrder(orderId);
    const result = await getGateway("ESEWA").verify(req.query as Record<string, unknown>);

    if (result.success) {
      assertResultMatchesPayment(result, payment);
      await finalizeSuccessfulPayment(payment.id, result);
      return res.redirect(`${env.webUrl}/checkout/success?orderId=${orderId}`);
    }
    await finalizeFailedPayment(payment.id, result.message);
    res.redirect(`${env.webUrl}/checkout/failed?orderId=${orderId}&reason=${encodeURIComponent(result.message ?? "")}`);
  })
);

// ---- CyberSource: browser POST (x-www-form-urlencoded) with signed fields ----
paymentsRouter.post(
  "/callback/cybersource",
  express.urlencoded({ extended: true }),
  asyncHandler(async (req, res) => {
    const orderId = req.query.orderId as string;
    const payment = await findPaymentForOrder(orderId);
    const result = await getGateway("CYBERSOURCE_NICASIA").verify(req.body as Record<string, unknown>);

    if (result.success) {
      assertResultMatchesPayment(result, payment);
      await finalizeSuccessfulPayment(payment.id, result);
      return res.redirect(`${env.webUrl}/checkout/success?orderId=${orderId}`);
    }
    await finalizeFailedPayment(payment.id, result.message);
    res.redirect(`${env.webUrl}/checkout/failed?orderId=${orderId}&reason=${encodeURIComponent(result.message ?? "")}`);
  })
);

// ---- Fonepay: no browser redirect (QR-based) — frontend polls this to check status ----
paymentsRouter.get(
  "/:paymentId/status",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: req.params.paymentId as string } });
    if (payment.status !== "PENDING") return res.json({ status: payment.status });

    if (payment.gateway === "FONEPAY") {
      const result = await getGateway("FONEPAY").verify({ referenceId: payment.referenceId });
      if (result.success) {
        await finalizeSuccessfulPayment(payment.id, result);
        return res.json({ status: "PAID" });
      }
    }
    res.json({ status: payment.status });
  })
);

// ---- Dev-only: simulate a successful/failed payment without hitting real gateway sandboxes.
// This lets the full checkout flow be demoed end-to-end before real merchant credentials exist.
// Disabled automatically when NODE_ENV=production.
const devCompleteSchema = z.object({ outcome: z.enum(["success", "failure"]).default("success") });

paymentsRouter.post(
  "/:paymentId/dev-complete",
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === "production") throw HttpError.forbidden("Not available in production");
    const { outcome } = devCompleteSchema.parse(req.body ?? {});
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: req.params.paymentId as string } });

    if (outcome === "success") {
      const updated = await finalizeSuccessfulPayment(payment.id, { success: true, transactionId: `TEST-${payment.referenceId}`, amount: Number(payment.amount) });
      return res.json(updated);
    }
    const updated = await finalizeFailedPayment(payment.id, "Simulated failure (dev-complete)");
    res.json(updated);
  })
);
