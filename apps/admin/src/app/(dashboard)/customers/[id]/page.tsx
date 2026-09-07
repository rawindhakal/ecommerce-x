"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";

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

export default function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setUser(await api.get<UserDetail>(`/api/users/${params.id}`));
  }
  useEffect(() => { load(); }, [params.id]);

  async function adjustPoints(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/loyalty/adjust", { userId: params.id, points: Number(points), note: note || undefined });
    setPoints(""); setNote("");
    load();
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
          <h2 className="mb-2 text-sm font-semibold">Loyalty Points: {user.loyaltyPoints}</h2>
          <form onSubmit={adjustPoints} className="space-y-2">
            <input type="number" required placeholder="Points (+/-)" className="input" value={points} onChange={(e) => setPoints(e.target.value)} />
            <input placeholder="Note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="btn-primary w-full">Adjust Points</button>
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
