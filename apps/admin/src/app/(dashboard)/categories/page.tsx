"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, Upload } from "lucide-react";
import { api, uploadFile, API_URL } from "@/lib/api";

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

const empty = { name: "", slug: "", imageUrl: "", parentId: "", isActive: true, sortOrder: 0, seoTitle: "", seoDescription: "" };

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setCategories(await api.get<Category[]>("/api/categories?includeInactive=true"));
  }

  useEffect(() => {
    load();
  }, []);

  function edit(cat: Category) {
    setEditingId(cat.id);
    setForm({ ...cat, imageUrl: cat.imageUrl ?? "", parentId: cat.parentId ?? "", seoTitle: cat.seoTitle ?? "", seoDescription: cat.seoDescription ?? "" });
    setShowForm(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm((f: any) => ({ ...f, imageUrl: url }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, parentId: form.parentId || null, sortOrder: Number(form.sortOrder) };
    if (editingId) await api.put(`/api/categories/${editingId}`, payload);
    else await api.post("/api/categories", payload);
    setForm(empty);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this category?")) return;
    await api.delete(`/api/categories/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <button className="btn-primary" onClick={() => { setForm(empty); setEditingId(null); setShowForm((v) => !v); }}>
          <Plus size={16} /> New Category
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Slug</label>
            <input required className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Category Image (shown on storefront home &amp; category page)</label>
            <div className="flex items-center gap-3">
              {form.imageUrl && <img src={imgSrc(form.imageUrl)} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />}
              <label className="btn-outline w-fit cursor-pointer">
                <Upload size={14} /> {form.imageUrl ? "Replace" : "Upload"} Image
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
          <div>
            <label className="label">Parent Category</label>
            <select className="input" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">None (Top-level)</option>
              {categories.filter((c) => c.id !== editingId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sort Order</label>
            <input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </div>
          <div>
            <label className="label">SEO Title</label>
            <input className="input" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          </div>
          <div>
            <label className="label">SEO Description</label>
            <input className="input" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">{editingId ? "Update" : "Create"} Category</button>
          </div>
        </form>
      )}

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th></th><th>Name</th><th>Slug</th><th>Parent</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.imageUrl ? (
                    <img src={imgSrc(c.imageUrl)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100" />
                  )}
                </td>
                <td>{c.name}</td>
                <td className="text-slate-500">{c.slug}</td>
                <td className="text-slate-500">{categories.find((p) => p.id === c.parentId)?.name ?? "—"}</td>
                <td><span className={`badge ${c.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{c.isActive ? "Active" : "Inactive"}</span></td>
                <td className="flex gap-2">
                  <button onClick={() => edit(c)} className="text-slate-400 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {categories.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-3">
            {c.imageUrl ? (
              <img src={imgSrc(c.imageUrl)} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-xs text-slate-500">/{c.slug} · {categories.find((p) => p.id === c.parentId)?.name ?? "Top-level"}</p>
              <span className={`badge mt-1 ${c.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{c.isActive ? "Active" : "Inactive"}</span>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <button onClick={() => edit(c)} className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-brand-600"><Pencil size={16} /></button>
              <button onClick={() => remove(c.id)} className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
