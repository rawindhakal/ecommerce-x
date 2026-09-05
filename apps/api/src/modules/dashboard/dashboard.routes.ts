import { Router } from "express";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, STAFF_ROLES } from "../../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireRole(...STAFF_ROLES));

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Range defaults to the last 30 days but can be overridden by the
    // dashboard's date filter to match whatever period the user picked.
    // Parsed as UTC calendar-day boundaries (not local setHours mutation on
    // a UTC-midnight date) so this doesn't silently shift by a day outside
    // UTC+0 — see the identical note in reports.routes.ts.
    const rangeTo = req.query.to ? new Date(`${String(req.query.to).slice(0, 10)}T23:59:59.999Z`) : now;
    const rangeFrom = req.query.from
      ? new Date(`${String(req.query.from).slice(0, 10)}T00:00:00.000Z`)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [todayOrders, rangeOrders, totalCustomers, lowStockCount, pendingOrders, revenueAgg, recentOrders, topProducts] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfToday }, paymentStatus: "PAID" } }),
      prisma.order.count({ where: { createdAt: { gte: rangeFrom, lte: rangeTo }, paymentStatus: "PAID" } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM inventory WHERE "quantityOnHand" <= "reorderPoint"`.then((r) => Number(r[0]?.count ?? 0)),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.aggregate({ where: { createdAt: { gte: rangeFrom, lte: rangeTo }, paymentStatus: "PAID" }, _sum: { total: true } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { items: true } }),
      prisma.orderItem.groupBy({
        by: ["productId", "name"],
        where: { order: { createdAt: { gte: rangeFrom, lte: rangeTo }, paymentStatus: "PAID" } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

    res.json({
      range: { from: rangeFrom, to: rangeTo },
      todayOrders,
      rangeOrders,
      totalCustomers,
      lowStockCount,
      pendingOrders,
      revenueInRange: Number(revenueAgg._sum.total ?? 0),
      recentOrders,
      topProducts: topProducts.map((p) => ({ productId: p.productId, name: p.name, unitsSold: p._sum.quantity ?? 0 })),
    });
  })
);
