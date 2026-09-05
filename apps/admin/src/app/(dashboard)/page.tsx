"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import { DateRangeFilter, presetRange, type DateRange } from "@/components/date-range-filter";

interface Summary {
  todayOrders: number;
  rangeOrders: number;
  totalCustomers: number;
  lowStockCount: number;
  pendingOrders: number;
  revenueInRange: number;
  recentOrders: { id: string; orderNumber: string; total: string; status: string; channel: string; createdAt: string }[];
  topProducts: { productId: string; name: string; unitsSold: number }[];
}

export default function DashboardHome() {
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>(`/api/dashboard/summary?from=${range.from}&to=${range.to}`).then(setSummary);
  }, [range]);

  const stats = summary
    ? [
        { label: "Orders Today", value: summary.todayOrders },
        { label: "Orders in Range", value: summary.rangeOrders },
        { label: "Revenue in Range", value: formatNpr(summary.revenueInRange) },
        { label: "Total Customers", value: summary.totalCustomers },
        { label: "Pending Orders", value: summary.pendingOrders },
        { label: "Low Stock Items", value: summary.lowStockCount },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={range} onChange={setRange} />
          <Link href="/reports" className="btn-outline whitespace-nowrap">Full Reports</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-x-auto p-5">
          <h2 className="mb-3 text-sm font-semibold">Recent Orders</h2>
          <table className="table-base">
            <thead>
              <tr><th>Order</th><th>Channel</th><th>Status</th><th>Total</th></tr>
            </thead>
            <tbody>
              {summary?.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/orders/${o.id}`} className="text-brand-600 hover:underline">{o.orderNumber}</Link></td>
                  <td>{o.channel}</td>
                  <td><span className="badge bg-slate-100 text-slate-600">{o.status}</span></td>
                  <td>{formatNpr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto p-5">
          <h2 className="mb-3 text-sm font-semibold">Top Products (in range)</h2>
          <table className="table-base">
            <thead>
              <tr><th>Product</th><th>Units Sold</th></tr>
            </thead>
            <tbody>
              {summary?.topProducts.map((p) => (
                <tr key={p.productId}>
                  <td>{p.name}</td>
                  <td>{p.unitsSold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
