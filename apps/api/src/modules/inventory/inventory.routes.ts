import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, STAFF_ROLES, ADMIN_ROLES, POS_ROLES } from "../../middleware/auth.js";
import { getPagination, paginate } from "../../lib/pagination.js";
import { applyStockMovement } from "./inventory.service.js";

export const inventoryRouter = Router();

inventoryRouter.get(
  "/",
  requireAuth,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const { locationId, lowStock, search } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (locationId) where.locationId = locationId;
    if (search) where.variant = { OR: [{ sku: { contains: search, mode: "insensitive" } }, { product: { name: { contains: search, mode: "insensitive" } } }] };

    const [rows, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: { variant: { include: { product: { select: { name: true, slug: true } } } }, location: true },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
      prisma.inventory.count({ where }),
    ]);

    const filtered = lowStock === "true" ? rows.filter((r) => r.quantityOnHand <= r.reorderPoint) : rows;
    res.json(paginate(filtered, lowStock === "true" ? filtered.length : total, page, pageSize));
  })
);

const adjustSchema = z.object({
  variantId: z.string(),
  locationId: z.string(),
  change: z.number().int(),
  reason: z.enum(["RESTOCK", "RETURN", "DAMAGE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"]),
  note: z.string().optional(),
});

inventoryRouter.post(
  "/adjust",
  requireAuth,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const data = adjustSchema.parse(req.body);
    const result = await applyStockMovement({ ...data, performedById: req.user!.id, allowNegative: true });
    res.json(result);
  })
);

inventoryRouter.get(
  "/movements/:variantId",
  requireAuth,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const movements = await prisma.stockMovement.findMany({
      where: { variantId: req.params.variantId as string },
      include: { location: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(movements);
  })
);

// ---- Locations ----
export const locationsRouter = Router();

locationsRouter.get(
  "/",
  requireAuth,
  requireRole(...POS_ROLES),
  asyncHandler(async (_req, res) => {
    res.json(await prisma.location.findMany({ orderBy: { name: "asc" } }));
  })
);

const locationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["WAREHOUSE", "STORE"]),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

locationsRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const location = await prisma.location.create({ data: locationSchema.parse(req.body) });
    res.status(201).json(location);
  })
);

locationsRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const location = await prisma.location.update({ where: { id: req.params.id as string }, data: locationSchema.partial().parse(req.body) });
    res.json(location);
  })
);
