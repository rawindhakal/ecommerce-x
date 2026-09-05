import { prisma } from "@ecommerce-x/db";
import { earnPointsForOrder } from "../loyalty/loyalty.service.js";
import { restockOrder } from "./orders.service.js";
import type { PaymentVerifyResult } from "@ecommerce-x/shared";

export async function finalizeSuccessfulPayment(paymentId: string, result: PaymentVerifyResult) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  if (payment.status === "PAID") return payment; // idempotent

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        transactionId: result.transactionId,
        rawResponse: (result.raw ?? {}) as object,
        paidAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "PAID", status: "CONFIRMED" },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: payment.orderId, status: "CONFIRMED", note: `Payment confirmed via ${payment.gateway}` },
    });

    if (payment.order.userId) {
      await earnPointsForOrder(tx, payment.order.userId, payment.orderId, Number(payment.order.total));
    }
  });

  return prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
}

export async function finalizeFailedPayment(paymentId: string, message?: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status === "PAID") return payment; // never downgrade a completed payment

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED", rawResponse: { message } as object } });
  await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: "FAILED" } });
  await prisma.orderStatusHistory.create({ data: { orderId: payment.orderId, status: "PENDING", note: `Payment failed: ${message ?? "unknown"}` } });
  await restockOrder(payment.orderId, "ADJUSTMENT");

  return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
}
