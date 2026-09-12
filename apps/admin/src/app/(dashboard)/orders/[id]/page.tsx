"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  channel: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: Record<string, string> | null;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  loyaltyDiscount: string;
  total: string;
  customerNote: string | null;
  items: { id: string; name: string; variantName: string | null; sku: string; quantity: number; unitPrice: string; total: string }[];
  payments: { id: string; gateway: string; status: string; amount: string; transactionId: string | null }[];
  statusHistory: { status: string; note: string | null; createdAt: string }[];
}

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"];

export default function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  async function load() {
    const data = await api.get<OrderDetail>(`/api/orders/${params.id}`);
    setOrder(data);
    setNewStatus(data.status);
  }

  useEffect(() => { load(); }, [params.id]);

  async function updateStatus() {
    setUpdating(true);
    try {
      await api.put(`/api/orders/${params.id}/status`, { status: newStatus, note: note || undefined });
      setNote("");
      load();
    } finally {
      setUpdating(false);
    }
  }

  if (!order) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Order {order.orderNumber}</h1>
        <p className="text-sm text-slate-500">{order.channel} · Payment: {order.paymentStatus}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Items</h2>
          <table className="table-base">
            <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}{i.variantName ? ` (${i.variantName})` : ""}</td>
                  <td className="text-slate-500">{i.sku}</td>
                  <td>{i.quantity}</td>
                  <td>{formatNpr(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatNpr(order.subtotal)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{formatNpr(order.discountTotal)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Shipping</span><span>{formatNpr(order.shippingTotal)}</span></div>
            {Number(order.loyaltyDiscount) > 0 && <div className="flex justify-between text-slate-500"><span>GlowPoints Redeemed</span><span>-{formatNpr(order.loyaltyDiscount)}</span></div>}
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatNpr(order.total)}</span></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Customer</h2>
            <p className="text-sm">{order.customerName}</p>
            <p className="text-sm text-slate-500">{order.customerEmail}</p>
            <p className="text-sm text-slate-500">{order.customerPhone}</p>
            {order.shippingAddress && (
              <p className="mt-2 text-sm text-slate-500">
                {order.shippingAddress.street ? `${order.shippingAddress.street}, ` : ""}
                {order.shippingAddress.municipality}, {order.shippingAddress.district}, {order.shippingAddress.province}
              </p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Payments</h2>
            {order.payments.map((p) => (
              <div key={p.id} className="text-sm text-slate-500">{p.gateway} — {p.status} — {formatNpr(p.amount)}</div>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Update Status</h2>
            <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input mt-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={updateStatus} disabled={updating} className="btn-primary mt-3 w-full">{updating ? "Updating…" : "Update Status"}</button>
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">History</h2>
            <ul className="space-y-1 text-xs text-slate-500">
              {order.statusHistory.map((h, i) => (
                <li key={i}>{h.status} — {new Date(h.createdAt).toLocaleString()} {h.note && `(${h.note})`}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
