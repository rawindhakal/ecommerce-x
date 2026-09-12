import { prisma } from "@ecommerce-x/db";
import type { Prisma } from "@ecommerce-x/db";
import { HttpError } from "../../lib/http-error.js";

export interface CreditAccount {
  userId: string;
  creditLimit: number;
  creditBalance: number;
  availableCredit: number;
}

export async function getCreditAccount(userId: string): Promise<CreditAccount> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { creditLimit: true, creditBalance: true } });
  if (!user) throw HttpError.notFound("Customer not found");
  const creditLimit = Number(user.creditLimit);
  const creditBalance = Number(user.creditBalance);
  return { userId, creditLimit, creditBalance, availableCredit: Math.max(0, creditLimit - creditBalance) };
}

/**
 * Charges a POS credit sale to a customer's account. Must run inside the
 * same transaction as the order/sale creation so the charge and the sale
 * are atomic — if either fails, both roll back.
 */
export async function chargeCredit(tx: Prisma.TransactionClient, userId: string, orderId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const available = Number(user.creditLimit) - Number(user.creditBalance);
  if (amount > available) {
    throw HttpError.badRequest(
      `This sale (Rs. ${amount.toFixed(2)}) exceeds the customer's available credit (Rs. ${available.toFixed(2)} of a Rs. ${Number(user.creditLimit).toFixed(2)} limit).`
    );
  }
  await tx.creditTransaction.create({ data: { userId, orderId, type: "CHARGE", amount, note: "POS credit sale" } });
  await tx.user.update({ where: { id: userId }, data: { creditBalance: { increment: amount } } });
}

/** Records the customer paying down their balance (cash, card, etc. taken at POS or by an admin). */
export async function recordCreditPayment(userId: string, amount: number, note: string | undefined): Promise<CreditAccount> {
  if (amount <= 0) throw HttpError.badRequest("Payment amount must be greater than zero.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.notFound("Customer not found");
  const balance = Number(user.creditBalance);
  if (amount > balance) {
    throw HttpError.badRequest(`Payment of Rs. ${amount.toFixed(2)} exceeds the outstanding balance of Rs. ${balance.toFixed(2)}.`);
  }

  await prisma.$transaction([
    prisma.creditTransaction.create({ data: { userId, type: "PAYMENT", amount: -amount, note: note || "Payment against balance" } }),
    prisma.user.update({ where: { id: userId }, data: { creditBalance: { decrement: amount } } }),
  ]);

  return getCreditAccount(userId);
}

export async function setCreditLimit(userId: string, creditLimit: number): Promise<CreditAccount> {
  if (creditLimit < 0) throw HttpError.badRequest("Credit limit cannot be negative.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.notFound("Customer not found");
  if (creditLimit < Number(user.creditBalance)) {
    throw HttpError.badRequest(`Credit limit can't be set below the current outstanding balance (Rs. ${Number(user.creditBalance).toFixed(2)}).`);
  }
  await prisma.user.update({ where: { id: userId }, data: { creditLimit } });
  return getCreditAccount(userId);
}
