"use client";

import { useEffect, useState, use } from "react";
import { api, ApiError } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { useAuthStore } from "@/lib/auth-store";

interface UserDetail {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  loyaltyPoints: number;
  isActive: boolean;
  addresses: { id: string; fullName: string; district: string; province: string }[];
  orders: { id: string; orderNumber: string; total: string; status: string; createdAt: string }[];
}

interface CreditAccount {
  creditLimit: number;
  creditBalance: number;
  availableCredit: number;
  transactions: { id: string; type: string; amount: string; note: string | null; createdAt: string; order: { orderNumber: string } | null }[];
}

export default function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const currentUser = useAuthStore((s) => s.user);
  const canEditLimit = currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN";
  const [user, setUser] = useState<UserDetail | null>(null);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [credit, setCredit] = useState<CreditAccount | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  async function load() {
    setUser(await api.get<UserDetail>(`/api/users/${params.id}`));
  }
  async function loadCredit() {
    try {
      const account = await api.get<CreditAccount>(`/api/credit/${params.id}`);
      setCredit(account);
      setNewLimit(String(account.creditLimit));
    } catch {
      // Non-customer accounts (staff/admin) don't have a credit account — ignore.
    }
  }
  useEffect(() => { load(); loadCredit(); }, [params.id]);

  async function adjustPoints(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/loyalty/adjust", { userId: params.id, points: Number(points), note: note || undefined });
    setPoints(""); setNote("");
    load();
  }

  async function saveCreditLimit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.put(`/api/credit/${params.id}/limit`, { creditLimit: Number(newLimit) });
      toast.success("Credit limit updated");
      loadCredit();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update credit limit");
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/api/credit/${params.id}/payment`, { amount: Number(paymentAmount) });
      toast.success("Payment recorded");
      setPaymentAmount("");
      loadCredit();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record payment");
    }
  }

  async function toggleActive() {
    if (!user) return;
    await api.put(`/api/users/${params.id}`, { isActive: !user.isActive });
    load();
  }

  if (!user) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{user.firstName} {user.lastName}</h1>
        <button onClick={toggleActive} className={user.isActive ? "btn-danger" : "btn-primary"}>{user.isActive ? "Deactivate" : "Activate"} Account</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold">Contact</h2>
          <p className="text-sm font-medium text-slate-800">{user.phone}</p>
          {user.email && <p className="text-sm text-slate-600">{user.email}</p>}
          <p className="mt-2 text-xs text-slate-400">Role: {user.role}</p>
        </div>

        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold">GlowPoints: {user.loyaltyPoints}</h2>
          <form onSubmit={adjustPoints} className="space-y-2">
            <input type="number" required placeholder="GlowPoints (+/-)" className="input" value={points} onChange={(e) => setPoints(e.target.value)} />
            <input placeholder="Note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="btn-primary w-full">Adjust GlowPoints</button>
          </form>
        </div>

        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold">Addresses</h2>
          {user.addresses.length === 0 && <p className="text-sm text-slate-400">No addresses saved.</p>}
          {user.addresses.map((a) => (
            <p key={a.id} className="text-sm text-slate-600">{a.fullName} — {a.district}, {a.province}</p>
          ))}
        </div>
      </div>

      {credit && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Store Credit</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Limit</span><span>{formatNpr(credit.creditLimit)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Outstanding Balance</span><span className={credit.creditBalance > 0 ? "font-medium text-red-500" : ""}>{formatNpr(credit.creditBalance)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold"><span>Available</span><span>{formatNpr(credit.availableCredit)}</span></div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Credit sales can only be created at the POS terminal.</p>
            {canEditLimit && (
              <form onSubmit={saveCreditLimit} className="mt-3 flex gap-2">
                <input type="number" min="0" step="0.01" className="input" placeholder="New limit" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
                <button type="submit" className="btn-outline whitespace-nowrap">Set Limit</button>
              </form>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Record a Payment</h2>
            <p className="mb-2 text-xs text-slate-400">Log cash/other payment received against this customer's outstanding balance.</p>
            <form onSubmit={recordPayment} className="space-y-2">
              <input type="number" required min="0.01" step="0.01" placeholder="Amount received" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <button type="submit" disabled={credit.creditBalance <= 0} className="btn-primary w-full disabled:opacity-40">Record Payment</button>
            </form>
          </div>

          <div className="card overflow-x-auto p-5 lg:col-span-1">
            <h2 className="mb-2 text-sm font-semibold">Recent Activity</h2>
            {credit.transactions.length === 0 ? (
              <p className="text-sm text-slate-400">No credit activity yet.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {credit.transactions.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex justify-between text-slate-500">
                    <span>{t.type}{t.order ? ` · ${t.order.orderNumber}` : ""}</span>
                    <span className={Number(t.amount) > 0 ? "text-red-500" : "text-green-600"}>{Number(t.amount) > 0 ? "+" : ""}{formatNpr(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-sm font-semibold">Orders</h2>
        <table className="table-base">
          <thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {user.orders.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{o.status}</td>
                <td>{formatNpr(o.total)}</td>
                <td className="text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
