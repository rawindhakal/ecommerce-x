"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface MenuItem {
  id: string;
  location: string;
  label: string;
  url: string;
  sortOrder: number;
  isActive: boolean;
}

const empty = { location: "HEADER", label: "", url: "", sortOrder: 0 };

export default function MenusPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setMenus(await api.get<MenuItem[]>("/api/menus/admin"));
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/menus", { ...form, sortOrder: Number(form.sortOrder) });
    setForm(empty);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    await api.delete(`/api/menus/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Navigation Menus</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}><Plus size={16} /> New Menu Item</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-4">
          <select className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
            <option value="HEADER">Header</option>
            <option value="FOOTER">Footer</option>
            <option value="MOBILE">Mobile</option>
          </select>
          <input required placeholder="Label" className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input required placeholder="URL (/categories/makeup)" className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <input type="number" placeholder="Sort order" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <button type="submit" className="btn-primary sm:col-span-4">Add Menu Item</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Location</th><th>Label</th><th>URL</th><th>Order</th><th></th></tr></thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.id}>
                <td className="text-slate-500">{m.location}</td>
                <td>{m.label}</td>
                <td className="text-slate-500">{m.url}</td>
                <td>{m.sortOrder}</td>
                <td><button onClick={() => remove(m.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
