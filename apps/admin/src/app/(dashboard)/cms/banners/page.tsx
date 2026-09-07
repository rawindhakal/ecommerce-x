"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Upload, Pencil, X } from "lucide-react";
import { api, uploadFile, API_URL } from "@/lib/api";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  placement: string;
  categorySlug: string | null;
  textPosition: string;
  theme: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const PLACEMENTS = [
  { value: "HOME_HERO", label: "Home Hero", hint: "Full-width rotating banner at the very top of the homepage." },
  { value: "HOME_PROMO", label: "Home Promo", hint: "Secondary promo strip further down the homepage. All active ones show, in order." },
  { value: "CATEGORY_TOP", label: "Category Top", hint: "Shows above the product grid on a category page. Leave category unset to show on every category page." },
  { value: "POPUP", label: "Popup", hint: "Shows as a dismissible overlay shortly after a visitor lands on the site." },
];

const empty = {
  title: "",
  subtitle: "",
  ctaText: "",
  imageUrl: "",
  mobileImageUrl: "",
  linkUrl: "",
  placement: "HOME_HERO",
  categorySlug: "",
  textPosition: "left",
  theme: "light",
  sortOrder: 0,
  isActive: true,
  startsAt: "",
  endsAt: "",
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function imgUrl(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setBanners(await api.get<Banner[]>("/api/banners/admin"));
  }
  useEffect(() => {
    load();
    api.get<Category[]>("/api/categories?includeInactive=true").then(setCategories);
  }, []);

  function startCreate() {
    setForm(empty);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(b: Banner) {
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? "",
      ctaText: b.ctaText ?? "",
      imageUrl: b.imageUrl,
      mobileImageUrl: b.mobileImageUrl ?? "",
      linkUrl: b.linkUrl ?? "",
      placement: b.placement,
      categorySlug: b.categorySlug ?? "",
      textPosition: b.textPosition,
      theme: b.theme,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      startsAt: toDatetimeLocal(b.startsAt),
      endsAt: toDatetimeLocal(b.endsAt),
    });
    setEditingId(b.id);
    setShowForm(true);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, field: "imageUrl" | "mobileImageUrl") {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    setForm((f: any) => ({ ...f, [field]: url }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      sortOrder: Number(form.sortOrder),
      subtitle: form.subtitle || null,
      ctaText: form.ctaText || null,
      mobileImageUrl: form.mobileImageUrl || null,
      linkUrl: form.linkUrl || null,
      categorySlug: form.placement === "CATEGORY_TOP" ? form.categorySlug || null : null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    if (editingId) {
      await api.put(`/api/banners/${editingId}`, payload);
    } else {
      await api.post("/api/banners", payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(empty);
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

  const grouped = PLACEMENTS.map((p) => ({ ...p, items: banners.filter((b) => b.placement === p.value) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Banners</h1>
        <button className="btn-primary" onClick={startCreate}><Plus size={16} /> New Banner</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <h2 className="text-sm font-semibold">{editingId ? "Edit Banner" : "New Banner"}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>

          <div><label className="label">Title</label><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Subtitle (optional)</label><input className="input" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>

          <div>
            <label className="label">Placement</label>
            <select className="input" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
              {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">{PLACEMENTS.find((p) => p.value === form.placement)?.hint}</p>
          </div>

          {form.placement === "CATEGORY_TOP" && (
            <div>
              <label className="label">Category (optional — blank shows on all)</label>
              <select className="input" value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div><label className="label">CTA Button Text (optional)</label><input placeholder="Shop Now" className="input" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} /></div>
          <div><label className="label">Link URL</label><input placeholder="/products?category=makeup" className="input" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} /></div>

          <div>
            <label className="label">Text Position</label>
            <select className="input" value={form.textPosition} onChange={(e) => setForm({ ...form, textPosition: e.target.value })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="label">Text Theme</label>
            <select className="input" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
              <option value="light">Light text (for dark/busy images)</option>
              <option value="dark">Dark text (for light/pastel images)</option>
            </select>
          </div>

          <div><label className="label">Sort Order</label><input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>

          <div><label className="label">Starts (optional)</label><input type="datetime-local" className="input" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
          <div><label className="label">Ends (optional)</label><input type="datetime-local" className="input" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>

          <div>
            <label className="label">Desktop Image</label>
            {form.imageUrl && <img src={imgUrl(form.imageUrl)} className="mb-2 h-24 rounded-lg object-cover" />}
            <label className="btn-outline w-fit cursor-pointer"><Upload size={14} /> Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "imageUrl")} /></label>
          </div>
          <div>
            <label className="label">Mobile Image (optional — falls back to desktop)</label>
            {form.mobileImageUrl && <img src={imgUrl(form.mobileImageUrl)} className="mb-2 h-24 rounded-lg object-cover" />}
            <label className="btn-outline w-fit cursor-pointer"><Upload size={14} /> Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "mobileImageUrl")} /></label>
          </div>

          <button type="submit" className="btn-primary sm:col-span-2">{editingId ? "Save Changes" : "Create Banner"}</button>
        </form>
      )}

      {grouped.map((group) => (
        <div key={group.value}>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">{group.label} <span className="font-normal text-slate-400">— {group.hint}</span></h2>
          {group.items.length === 0 ? (
            <p className="mb-6 text-sm text-slate-400">No banners in this placement.</p>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {group.items.map((b) => (
                <div key={b.id} className="card overflow-hidden">
                  <div className="relative h-32 w-full bg-slate-100">
                    <img src={imgUrl(b.imageUrl)} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">{b.title}</p>
                    {b.subtitle && <p className="truncate text-xs text-slate-400">{b.subtitle}</p>}
                    {b.categorySlug && <p className="mt-1 text-xs text-slate-400">Category: {b.categorySlug}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <button onClick={() => toggle(b)} className={`badge ${b.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{b.isActive ? "Active" : "Inactive"}</button>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(b)} className="text-slate-400 hover:text-brand-600"><Pencil size={15} /></button>
                        <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
