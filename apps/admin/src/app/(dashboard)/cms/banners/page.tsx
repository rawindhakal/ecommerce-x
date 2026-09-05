"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { api, uploadFile, API_URL } from "@/lib/api";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  placement: string;
  sortOrder: number;
  isActive: boolean;
}

const empty = { title: "", imageUrl: "", linkUrl: "", placement: "HOME_HERO", sortOrder: 0, isActive: true };

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setBanners(await api.get<Banner[]>("/api/banners/admin"));
  }
  useEffect(() => { load(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm({ ...form, imageUrl: url });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/banners", { ...form, sortOrder: Number(form.sortOrder) });
    setForm(empty);
    setShowForm(false);
    load();
  }

  async function toggle(b: Banner) {
    await api.put(`/api/banners/${b.id}`, { isActive: !b.isActive });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this banner?")) return;
    await api.delete(`/api/banners/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Banners</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}><Plus size={16} /> New Banner</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div><label className="label">Title</label><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <label className="label">Placement</label>
            <select className="input" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
              <option value="HOME_HERO">Home Hero</option>
              <option value="HOME_PROMO">Home Promo</option>
              <option value="CATEGORY_TOP">Category Top</option>
              <option value="POPUP">Popup</option>
            </select>
          </div>
          <div><label className="label">Link URL</label><input className="input" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} /></div>
          <div><label className="label">Sort Order</label><input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <label className="label">Image</label>
            {form.imageUrl && <img src={form.imageUrl.startsWith("http") ? form.imageUrl : `${API_URL}${form.imageUrl}`} className="mb-2 h-32 rounded-lg object-cover" />}
            <label className="btn-outline w-fit cursor-pointer"><Upload size={14} /> Upload Image<input type="file" accept="image/*" className="hidden" onChange={handleUpload} /></label>
          </div>
          <button type="submit" className="btn-primary sm:col-span-2">Create Banner</button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {banners.map((b) => (
          <div key={b.id} className="card overflow-hidden">
            <img src={b.imageUrl.startsWith("http") ? b.imageUrl : `${API_URL}${b.imageUrl}`} className="h-32 w-full object-cover" />
            <div className="p-3">
              <p className="text-sm font-medium">{b.title}</p>
              <p className="text-xs text-slate-400">{b.placement}</p>
              <div className="mt-2 flex justify-between">
                <button onClick={() => toggle(b)} className={`badge ${b.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{b.isActive ? "Active" : "Inactive"}</button>
                <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
