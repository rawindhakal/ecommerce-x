import { Router } from "express";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { getPagination, paginate } from "../../lib/pagination.js";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const { action, entityType } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entityType) where.entityType = entityType;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, phone: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);
