import { prisma } from "@ecommerce-x/db";
import type { Prisma } from "@ecommerce-x/db";

export async function getLoyaltyRule() {
  const rule = await prisma.loyaltyRule.findFirst();
  return (
    rule ?? {
      isActive: true,
      earnPointsPerNpr: 0.05,
      redeemPointValue: 1,
      minRedeemPoints: 100,
      maxRedeemPercent: 50,
      pointsExpireDays: null as number | null,
    }
  );
}

export async function earnPointsForOrder(tx: Prisma.TransactionClient, userId: string, orderId: string, orderTotal: number) {
  const rule = await getLoyaltyRule();
  if (!rule.isActive) return 0;
  const points = Math.floor(orderTotal * Number(rule.earnPointsPerNpr));
  if (points <= 0) return 0;

  await tx.loyaltyTransaction.create({ data: { userId, orderId, type: "EARN", points, note: "Earned from order" } });
  await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } });
  return points;
}

export async function redeemPointsForOrder(tx: Prisma.TransactionClient, userId: string, orderId: string, pointsToRedeem: number) {
  const rule = await getLoyaltyRule();
  if (pointsToRedeem < rule.minRedeemPoints) {
    throw new Error(`Minimum ${rule.minRedeemPoints} points required to redeem`);
  }
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.loyaltyPoints < pointsToRedeem) throw new Error("Insufficient loyalty points");

  const discountValue = pointsToRedeem * Number(rule.redeemPointValue);
  await tx.loyaltyTransaction.create({ data: { userId, orderId, type: "REDEEM", points: -pointsToRedeem, note: "Redeemed at checkout" } });
  await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { decrement: pointsToRedeem } } });
  return discountValue;
}

export function maxRedeemablePoints(orderSubtotal: number, userPoints: number, rule: Awaited<ReturnType<typeof getLoyaltyRule>>) {
  const maxByOrderCap = Math.floor((orderSubtotal * Number(rule.maxRedeemPercent)) / 100 / Number(rule.redeemPointValue));
  return Math.max(0, Math.min(userPoints, maxByOrderCap));
}
