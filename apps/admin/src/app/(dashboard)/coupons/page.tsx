"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: string;
  minSpend: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
}

const empty = { code: "", type: "PERCENTAGE", value: "", minSpend: "", maxDiscount: "", usageLimit: "", expiresAt: "" };

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get<PaginatedResult<Coupon>>("/api/coupons?pageSize=50");
      setCoupons(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load coupons.");
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/coupons", {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minSpend: form.minSpend ? Number(form.minSpend) : undefined,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      });
      toast.success("Coupon created");
      setForm(empty);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create coupon. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: Coupon) {
    try {
      await api.put(`/api/coupons/${c.id}`, { isActive: !c.isActive });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update coupon status.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    try {
      await api.delete(`/api/coupons/${id}`);
      toast.success("Coupon deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete coupon.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coupons</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}><Plus size={16} /> New Coupon</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <input required minLength={3} placeholder="CODE *" className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed Amount</option>
            <option value="FREE_SHIPPING">Free Shipping</option>
          </select>
          <input required type="number" placeholder="Value *" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input type="number" placeholder="Min Spend" className="input" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })} />
          <input type="number" placeholder="Max Discount" className="input" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
          <input type="number" placeholder="Usage Limit" className="input" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          <input type="date" className="input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          <button type="submit" disabled={saving} className="btn-primary sm:col-span-3">
            {saving && <Spinner />} {saving ? "Saving…" : "Create Coupon"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Usage</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="font-mono font-medium">{c.code}</td>
                <td className="text-slate-500">{c.type}</td>
                <td>{c.type === "PERCENTAGE" ? `${c.value}%` : formatNpr(c.value)}</td>
                <td className="text-slate-500">{c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td>
                  <button onClick={() => toggle(c)} className={`badge ${c.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td><button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
