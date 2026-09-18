"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, Upload, LibraryBig } from "lucide-react";
import { slugify } from "@ecommerce-x/shared";
import { api, uploadFile, ApiError, API_URL } from "@/lib/api";
import { MediaLibraryPicker } from "@/components/media-library-picker";
import { FormLabel } from "@/components/form-label";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  seoTitle: string | null;
}

const empty = { name: "", slug: "", logoUrl: "", isActive: true, seoTitle: "" };

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      setBrands(await api.get<Brand[]>("/api/brands?includeInactive=true"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load brands.");
    }
  }
  useEffect(() => { load(); }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm((f: any) => ({ ...f, logoUrl: url }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Logo upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await api.put(`/api/brands/${editingId}`, form);
      else await api.post("/api/brands", form);
      toast.success(editingId ? "Brand updated" : "Brand created");
      setForm(empty); setEditingId(null); setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save brand. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function edit(b: Brand) {
    setEditingId(b.id);
    setForm({ ...b, logoUrl: b.logoUrl ?? "", seoTitle: b.seoTitle ?? "" });
    setShowForm(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this brand?")) return;
    try {
      await api.delete(`/api/brands/${id}`);
      toast.success("Brand deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete brand.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brands</h1>
        <button className="btn-primary" onClick={() => { setForm(empty); setEditingId(null); setShowForm((v) => !v); }}><Plus size={16} /> New Brand</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div><FormLabel required>Name</FormLabel><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <FormLabel>Slug</FormLabel>
            <input disabled className="input cursor-not-allowed bg-slate-50 text-slate-500" value={form.slug || (form.name ? slugify(form.name) : "")} placeholder="Generated automatically from the name" />
          </div>
          <div className="sm:col-span-2">
            <FormLabel>Brand Logo (shown on storefront brand filters &amp; product pages)</FormLabel>
            <div className="flex items-center gap-3">
              {form.logoUrl && <img src={imgSrc(form.logoUrl)} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-contain bg-white p-1" />}
              <label className="btn-outline w-fit cursor-pointer">
                {uploading ? <Spinner /> : <Upload size={14} />} {uploading ? "Uploading…" : form.logoUrl ? "Replace" : "Upload"} Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
              <button type="button" onClick={() => setShowLibrary(true)} className="btn-outline w-fit">
                <LibraryBig size={14} /> Browse Library
              </button>
            </div>
          </div>
          <div className="sm:col-span-2"><FormLabel>SEO Title</FormLabel><input className="input" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Spinner />} {saving ? "Saving…" : editingId ? "Update Brand" : "Create Brand"}
            </button>
          </div>
        </form>
      )}

      <MediaLibraryPicker
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelect={([picked]) => setForm((f: any) => ({ ...f, logoUrl: picked.url }))}
      />

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th></th><th>Name</th><th>Slug</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.logoUrl ? (
                    <img src={imgSrc(b.logoUrl)} alt="" className="h-10 w-10 rounded-lg border border-slate-100 object-contain bg-white p-1" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100" />
                  )}
                </td>
                <td>{b.name}</td>
                <td className="text-slate-500">{b.slug}</td>
                <td><span className={`badge ${b.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{b.isActive ? "Active" : "Inactive"}</span></td>
                <td className="flex gap-2">
                  <button onClick={() => edit(b)} className="text-slate-400 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {brands.map((b) => (
          <div key={b.id} className="card flex items-center gap-3 p-3">
            {b.logoUrl ? (
              <img src={imgSrc(b.logoUrl)} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg border border-slate-100 object-contain bg-white p-1" />
            ) : (
              <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{b.name}</p>
              <p className="truncate text-xs text-slate-500">/{b.slug}</p>
              <span className={`badge mt-1 ${b.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{b.isActive ? "Active" : "Inactive"}</span>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <button onClick={() => edit(b)} className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-brand-600"><Pencil size={16} /></button>
              <button onClick={() => remove(b.id)} className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
