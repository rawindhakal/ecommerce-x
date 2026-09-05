"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Order {
  id: string;
  orderNumber: string;
  total: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<PaginatedResult<Order>>("/api/orders?pageSize=50").then((r) => setOrders(r.items));
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl">My Orders</h1>
      <div className="card mt-6 divide-y divide-ink/10">
        {orders.length === 0 && <p className="p-5 text-sm text-ink/50">No orders yet.</p>}
        {orders.map((o) => (
          <Link key={o.id} href={`/account/orders/${o.id}`} className="flex items-center justify-between p-4 text-sm hover:bg-ink/5">
            <div>
              <p className="font-medium">{o.orderNumber}</p>
              <p className="text-ink/50">{new Date(o.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{formatNpr(o.total)}</p>
              <p className="text-xs uppercase text-ink/50">{o.status} · {o.paymentStatus}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
