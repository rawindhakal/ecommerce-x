"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NEPAL_PROVINCES } from "@ecommerce-x/shared";

interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  ward: string | null;
  street: string | null;
  isDefault: boolean;
}

const empty = { label: "", fullName: "", phone: "", province: "Bagmati", district: "", municipality: "", ward: "", street: "", isDefault: false };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);

  async function load() {
    setAddresses(await api.get<Address[]>("/api/addresses"));
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/addresses", form);
    setForm(empty);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    await api.delete(`/api/addresses/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Addresses</h1>
        <button className="btn-outline" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add Address"}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mt-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <input className="input" placeholder="Label (Home, Office)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className="input" required placeholder="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="input" required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
            {NEPAL_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="input" required placeholder="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <input className="input" required placeholder="Municipality" value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} />
          <input className="input" placeholder="Ward No." value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} />
          <input className="input sm:col-span-2" placeholder="Street Address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default
          </label>
          <button type="submit" className="btn-primary sm:col-span-2">Save Address</button>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{a.label || "Address"} {a.isDefault && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">Default</span>}</p>
              <button onClick={() => remove(a.id)} className="text-xs text-red-500">Remove</button>
            </div>
            <p className="mt-1 text-sm text-ink/60">{a.fullName} · {a.phone}</p>
            <p className="text-sm text-ink/60">{a.street ? `${a.street}, ` : ""}{a.municipality}, {a.district}, {a.province}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
