import { Router } from "express";
import { prisma } from "@ecommerce-x/db";
import type { Prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, STAFF_ROLES } from "../../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole(...STAFF_ROLES));

/**
 * Parses `from`/`to` as UTC calendar-day boundaries, not local time. Mixing
 * a UTC-parsed date with local setHours()/setDate() mutations silently
 * shifts the whole range by a day in any timezone that isn't UTC+0 — this
 * keeps every boundary computed in UTC so "today" always means the same
 * thing regardless of the server's local timezone.
 */
function parseRange(req: import("express").Request) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  const toStr = req.query.to ? String(req.query.to).slice(0, 10) : todayUTC;
  const fromStr = req.query.from
    ? String(req.query.from).slice(0, 10)
    : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);

  const channel = req.query.channel as "ONLINE" | "POS" | undefined;
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return { from, to, channel, prevFrom, prevTo };
}

function orderWhere(from: Date, to: Date, channel?: "ONLINE" | "POS"): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: from, lte: to },
    paymentStatus: "PAID",
    ...(channel ? { channel } : {}),
  };
}

reportsRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const { from, to, channel, prevFrom, prevTo } = parseRange(req);

    const [current, previous, unitsAgg] = await Promise.all([
      prisma.order.aggregate({
        where: orderWhere(from, to, channel),
        _sum: { total: true, discountTotal: true, taxTotal: true, shippingTotal: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: orderWhere(prevFrom, prevTo, channel),
        _sum: { total: true },
        _count: true,
      }),
      prisma.orderItem.aggregate({
        where: { order: orderWhere(from, to, channel) },
        _sum: { quantity: true },
      }),
    ]);

    const revenue = Number(current._sum.total ?? 0);
    const prevRevenue = Number(previous._sum.total ?? 0);
    const orders = current._count;
    const prevOrders = previous._count;

    res.json({
      range: { from, to },
      revenue,
      revenueChangePct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null,
      orders,
      ordersChangePct: prevOrders > 0 ? ((orders - prevOrders) / prevOrders) * 100 : null,
      avgOrderValue: orders > 0 ? revenue / orders : 0,
      unitsSold: unitsAgg._sum.quantity ?? 0,
      discountTotal: Number(current._sum.discountTotal ?? 0),
      taxTotal: Number(current._sum.taxTotal ?? 0),
      shippingTotal: Number(current._sum.shippingTotal ?? 0),
    });
  })
);

reportsRouter.get(
  "/sales-trend",
  asyncHandler(async (req, res) => {
    const { from, to, channel } = parseRange(req);
    const orders = await prisma.order.findMany({
      where: orderWhere(from, to, channel),
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    });

    const byDay = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { date: key, revenue: 0, orders: 0 };
      entry.revenue += Number(o.total);
      entry.orders += 1;
      byDay.set(key, entry);
    }

    // Fill gaps so the line chart doesn't skip empty days. `from`/`to` are
    // already UTC midnight-anchored (see parseRange), so pure UTC-date
    // increments here keep every key aligned with the `byDay` map above.
    const days: { date: string; revenue: number; orders: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      days.push(byDay.get(key) ?? { date: key, revenue: 0, orders: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    res.json(days);
  })
);

reportsRouter.get(
  "/by-channel",
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    const [online, pos] = await Promise.all([
      prisma.order.aggregate({ where: orderWhere(from, to, "ONLINE"), _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: orderWhere(from, to, "POS"), _sum: { total: true }, _count: true }),
    ]);
    res.json([
      { channel: "ONLINE", revenue: Number(online._sum.total ?? 0), orders: online._count },
      { channel: "POS", revenue: Number(pos._sum.total ?? 0), orders: pos._count },
    ]);
  })
);

reportsRouter.get(
  "/top-products",
  asyncHandler(async (req, res) => {
    const { from, to, channel } = parseRange(req);
    const grouped = await prisma.orderItem.groupBy({
      by: ["productId", "name"],
      where: { order: orderWhere(from, to, channel) },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 15,
    });
    res.json(grouped.map((g) => ({ productId: g.productId, name: g.name, unitsSold: g._sum.quantity ?? 0, revenue: Number(g._sum.total ?? 0) })));
  })
);

reportsRouter.get(
  "/by-category",
  asyncHandler(async (req, res) => {
    const { from, to, channel } = parseRange(req);
    const items = await prisma.orderItem.findMany({
      where: { order: orderWhere(from, to, channel) },
      select: { quantity: true, total: true, product: { select: { category: { select: { name: true } } } } },
    });
    const byCategory = new Map<string, { category: string; unitsSold: number; revenue: number }>();
    for (const item of items) {
      const name = item.product.category?.name ?? "Uncategorized";
      const entry = byCategory.get(name) ?? { category: name, unitsSold: 0, revenue: 0 };
      entry.unitsSold += item.quantity;
      entry.revenue += Number(item.total);
      byCategory.set(name, entry);
    }
    res.json(Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue));
  })
);

reportsRouter.get(
  "/payment-methods",
  asyncHandler(async (req, res) => {
    const { from, to, channel } = parseRange(req);
    const grouped = await prisma.payment.groupBy({
      by: ["gateway"],
      where: { status: "PAID", createdAt: { gte: from, lte: to }, order: channel ? { channel } : undefined },
      _sum: { amount: true },
      _count: true,
    });
    res.json(grouped.map((g) => ({ gateway: g.gateway, revenue: Number(g._sum.amount ?? 0), count: g._count })).sort((a, b) => b.revenue - a.revenue));
  })
);

reportsRouter.get(
  "/coupons",
  asyncHandler(async (req, res) => {
    const { from, to, channel } = parseRange(req);
    const orders = await prisma.order.findMany({
      where: { ...orderWhere(from, to, channel), couponId: { not: null } },
      select: { discountTotal: true, coupon: { select: { id: true, code: true } } },
    });
    const byCoupon = new Map<string, { code: string; uses: number; discountGiven: number }>();
    for (const o of orders) {
      if (!o.coupon) continue;
      const entry = byCoupon.get(o.coupon.id) ?? { code: o.coupon.code, uses: 0, discountGiven: 0 };
      entry.uses += 1;
      entry.discountGiven += Number(o.discountTotal);
      byCoupon.set(o.coupon.id, entry);
    }
    res.json(Array.from(byCoupon.values()).sort((a, b) => b.discountGiven - a.discountGiven));
  })
);

reportsRouter.get(
  "/top-customers",
  asyncHandler(async (req, res) => {
    const { from, to, channel } = parseRange(req);
    const grouped = await prisma.order.groupBy({
      by: ["userId"],
      where: { ...orderWhere(from, to, channel), userId: { not: null } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: 15,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId!).filter(Boolean) } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, loyaltyPoints: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    res.json(
      grouped.map((g) => ({
        user: userMap.get(g.userId!),
        orders: g._count,
        totalSpent: Number(g._sum.total ?? 0),
      }))
    );
  })
);

reportsRouter.get(
  "/inventory",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.inventory.findMany({
      include: { variant: { select: { sku: true, price: true, costPrice: true, product: { select: { name: true } } } }, location: { select: { name: true } } },
    });

    const stockValue = rows.reduce((sum, r) => sum + r.quantityOnHand * Number(r.variant.costPrice ?? r.variant.price), 0);
    const totalUnits = rows.reduce((sum, r) => sum + r.quantityOnHand, 0);
    const lowStock = rows
      .filter((r) => r.quantityOnHand <= r.reorderPoint)
      .map((r) => ({ product: r.variant.product.name, sku: r.variant.sku, location: r.location.name, quantityOnHand: r.quantityOnHand, reorderPoint: r.reorderPoint }));

    res.json({ stockValue, totalUnits, lowStockCount: lowStock.length, lowStock });
  })
);

reportsRouter.get(
  "/pos-sessions",
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    const sessions = await prisma.posSession.findMany({
      where: { openedAt: { gte: from, lte: to } },
      include: { location: { select: { name: true } }, cashier: { select: { firstName: true, lastName: true } } },
      orderBy: { openedAt: "desc" },
    });
    res.json(
      sessions.map((s) => ({
        id: s.id,
        location: s.location.name,
        cashier: `${s.cashier.firstName ?? ""} ${s.cashier.lastName ?? ""}`.trim(),
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openingBalance: Number(s.openingBalance),
        closingBalance: s.closingBalance ? Number(s.closingBalance) : null,
        expectedBalance: s.expectedBalance ? Number(s.expectedBalance) : null,
        variance: s.closingBalance && s.expectedBalance ? Number(s.closingBalance) - Number(s.expectedBalance) : null,
      }))
    );
  })
);
