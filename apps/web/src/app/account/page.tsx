"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatNpr } from "@/lib/format";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Order {
  id: string;
  orderNumber: string;
  total: string;
  status: string;
  createdAt: string;
}

export default function AccountOverview() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<PaginatedResult<Order>>("/api/orders?pageSize=5").then((r) => setOrders(r.items));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl">My Account</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-ink/50">GlowPoints</p>
          <p className="mt-1 text-2xl font-semibold">{user?.loyaltyPoints ?? 0}</p>
          <Link href="/account/loyalty" className="mt-2 inline-block text-xs text-brand">View details</Link>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink/50">Phone Number</p>
          <p className="mt-1 text-lg font-medium">{user?.phone}</p>
          {user?.email && <p className="mt-0.5 text-xs text-ink/40">{user.email}</p>}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg">Recent Orders</h2>
          <Link href="/account/orders" className="text-sm text-brand">View all</Link>
        </div>
        <div className="card divide-y divide-ink/10">
          {orders.length === 0 && <p className="p-5 text-sm text-ink/50">No orders yet.</p>}
          {orders.map((o) => (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="flex items-center justify-between p-4 text-sm hover:bg-ink/5">
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-ink/50">{new Date(o.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatNpr(o.total)}</p>
                <p className="text-xs uppercase text-ink/50">{o.status}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
