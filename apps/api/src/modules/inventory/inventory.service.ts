import { prisma } from "@ecommerce-x/db";
import type { StockMovementReason, Prisma } from "@ecommerce-x/db";
import { HttpError } from "../../lib/http-error.js";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Applies a stock change atomically and logs it. `change` is signed:
 * positive increases quantityOnHand, negative decreases it.
 *
 * Pass `tx` when this is already running inside a caller's `$transaction` —
 * otherwise it opens its own, which would NOT roll back if the caller's
 * surrounding transaction later fails (Prisma transactions don't nest).
 */
export async function applyStockMovement(
  params: {
    variantId: string;
    locationId: string;
    change: number;
    reason: StockMovementReason;
    reference?: string;
    note?: string;
    performedById?: string;
    allowNegative?: boolean;
  },
  tx?: Prisma.TransactionClient
) {
  if (tx) return runStockMovement(tx, params);
  return prisma.$transaction((innerTx) => runStockMovement(innerTx, params));
}

async function runStockMovement(
  db: Db,
  params: {
    variantId: string;
    locationId: string;
    change: number;
    reason: StockMovementReason;
    reference?: string;
    note?: string;
    performedById?: string;
    allowNegative?: boolean;
  }
) {
  const inventory = await db.inventory.upsert({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
    update: {},
    create: { variantId: params.variantId, locationId: params.locationId, quantityOnHand: 0 },
  });

  const newQty = inventory.quantityOnHand + params.change;
  if (newQty < 0 && !params.allowNegative) {
    throw HttpError.badRequest("Insufficient stock for this operation");
  }

  const updated = await db.inventory.update({
    where: { variantId_locationId: { variantId: params.variantId, locationId: params.locationId } },
    data: { quantityOnHand: newQty },
  });

  await db.stockMovement.create({
    data: {
      variantId: params.variantId,
      locationId: params.locationId,
      change: params.change,
      reason: params.reason,
      reference: params.reference,
      note: params.note,
      performedById: params.performedById,
    },
  });

  return updated;
}

/**
 * This is a single-location system — there is exactly one Location row,
 * used only as the FK anchor for Inventory/StockMovement/Order/PosSession.
 * Callers resolve it here instead of asking the client (POS terminal,
 * inventory adjustment form, etc.) to pick one.
 */
export async function getTheLocationId(): Promise<string> {
  const location = await prisma.location.findFirst({ orderBy: { createdAt: "asc" } });
  if (!location) throw HttpError.badRequest("No store location is configured");
  return location.id;
}

export async function getAvailableStock(variantId: string, locationId?: string): Promise<number> {
  const rows = await prisma.inventory.findMany({ where: { variantId, locationId } });
  return rows.reduce((sum, r) => sum + (r.quantityOnHand - r.quantityReserved), 0);
}

/**
 * Deducts `quantity` units of a variant from wherever stock actually exists,
 * across every location, instead of a single hardcoded location. This is what
 * makes online and POS sales draw from one connected pool: whichever channel
 * sells first depletes the real combined total, so the other channel sees an
 * accurate "in stock" figure and can never oversell what's physically there.
 * Consumes from the location with the most stock first, spilling into the
 * next location only if one location alone can't cover the quantity.
 *
 * Pass `tx` when already inside a caller's `$transaction` (see note above).
 */
export async function deductStockAcrossLocations(
  params: {
    variantId: string;
    quantity: number;
    reason: StockMovementReason;
    reference?: string;
    note?: string;
    performedById?: string;
  },
  tx?: Prisma.TransactionClient
) {
  if (params.quantity <= 0) return [];
  if (tx) return runDeduction(tx, params);
  return prisma.$transaction((innerTx) => runDeduction(innerTx, params));
}

async function runDeduction(
  db: Db,
  params: {
    variantId: string;
    quantity: number;
    reason: StockMovementReason;
    reference?: string;
    note?: string;
    performedById?: string;
  }
) {
  const rows = await db.inventory.findMany({
    where: { variantId: params.variantId },
    orderBy: { quantityOnHand: "desc" },
  });

  let remaining = params.quantity;
  const plan: { locationId: string; take: number }[] = [];

  for (const row of rows) {
    if (remaining <= 0) break;
    const available = row.quantityOnHand - row.quantityReserved;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    plan.push({ locationId: row.locationId, take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw HttpError.badRequest("Insufficient stock across all locations for this operation");
  }

  for (const step of plan) {
    await db.inventory.update({
      where: { variantId_locationId: { variantId: params.variantId, locationId: step.locationId } },
      data: { quantityOnHand: { decrement: step.take } },
    });
    await db.stockMovement.create({
      data: {
        variantId: params.variantId,
        locationId: step.locationId,
        change: -step.take,
        reason: params.reason,
        reference: params.reference,
        note: params.note,
        performedById: params.performedById,
      },
    });
  }

  return plan;
}

/**
 * Adds `quantity` units back (returns/cancellations). Always credited to the
 * default location — where a physical return should be restocked to, unless
 * staff later transfer it elsewhere.
 */
export async function restockToDefaultLocation(
  params: { variantId: string; quantity: number; reason: StockMovementReason; reference?: string },
  tx?: Prisma.TransactionClient
) {
  const db: Db = tx ?? prisma;
  const defaultLocation = await db.location.findFirst({ where: { isDefault: true } });
  if (!defaultLocation) return;
  await applyStockMovement(
    {
      variantId: params.variantId,
      locationId: defaultLocation.id,
      change: params.quantity,
      reason: params.reason,
      reference: params.reference,
      allowNegative: true,
    },
    tx
  );
}
