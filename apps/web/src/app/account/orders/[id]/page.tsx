"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";

interface OrderDetail {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  total: string;
  shippingAddress: Record<string, string> | null;
  items: { id: string; name: string; variantName: string | null; quantity: number; total: string }[];
  statusHistory: { status: string; note: string | null; createdAt: string }[];
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    api.get<OrderDetail>(`/api/orders/${params.id}`).then(setOrder);
  }, [params.id]);

  if (!order) return <p className="text-ink/50">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Order {order.orderNumber}</h1>
        <p className="text-sm text-ink/50">{order.status} · Payment: {order.paymentStatus}</p>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Items</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.name}{item.variantName ? ` (${item.variantName})` : ""} × {item.quantity}</span>
              <span>{formatNpr(item.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-ink/10 pt-3 text-sm">
          <div className="flex justify-between text-ink/60"><span>Subtotal</span><span>{formatNpr(order.subtotal)}</span></div>
          <div className="flex justify-between text-ink/60"><span>Shipping</span><span>{formatNpr(order.shippingTotal)}</span></div>
          <div className="flex justify-between text-ink/60"><span>Tax</span><span>{formatNpr(order.taxTotal)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{formatNpr(order.total)}</span></div>
        </div>
      </div>

      {order.shippingAddress && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold">Delivery Address</h2>
          <p className="text-sm text-ink/70">
            {order.shippingAddress.fullName}, {order.shippingAddress.street ? `${order.shippingAddress.street}, ` : ""}
            {order.shippingAddress.municipality}, {order.shippingAddress.district}, {order.shippingAddress.province}
          </p>
          <p className="text-sm text-ink/70">{order.shippingAddress.phone}</p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Status History</h2>
        <ul className="space-y-2 text-sm text-ink/60">
          {order.statusHistory.map((h, i) => (
            <li key={i}>
              <span className="font-medium text-ink">{h.status}</span> — {new Date(h.createdAt).toLocaleString()}
              {h.note && <span className="text-ink/40"> ({h.note})</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
