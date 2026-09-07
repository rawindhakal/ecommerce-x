import { prisma } from "@ecommerce-x/db";

/**
 * Records who did what to sensitive data. Deliberately fire-and-forget with
 * its own try/catch — an audit-log write failing must never break the
 * actual request it's describing.
 */
export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as any,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
