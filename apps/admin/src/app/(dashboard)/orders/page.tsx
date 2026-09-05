"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  channel: string;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  SHIPPED: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-green-50 text-green-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  REFUNDED: "bg-red-50 text-red-700",
};

export default function OrdersPage() {
  const [result, setResult] = useState<PaginatedResult<Order> | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const qs = new URLSearchParams({ pageSize: "30" });
    if (status) qs.set("status", status);
    if (search) qs.set("search", search);
    setResult(await api.get<PaginatedResult<Order>>(`/api/orders/admin?${qs.toString()}`));
  }

  useEffect(() => { load(); }, [status]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      <div className="flex gap-3">
        <input className="input max-w-xs" placeholder="Search order #, customer, phone…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Payment</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {result?.items.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">{o.orderNumber}</Link></td>
                <td>{o.customerName}</td>
                <td className="text-slate-500">{o.channel}</td>
                <td className="text-slate-500">{o.paymentStatus}</td>
                <td><span className={`badge ${STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-600"}`}>{o.status}</span></td>
                <td>{formatNpr(o.total)}</td>
                <td className="text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {result?.items.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="card block p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-brand-600">{o.orderNumber}</span>
              <span className={`badge ${STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-600"}`}>{o.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{o.customerName}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">{o.channel} · {o.paymentStatus}</span>
              <span className="font-semibold">{formatNpr(o.total)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
