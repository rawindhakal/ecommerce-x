"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, LayoutTemplate } from "lucide-react";
import { HOME_PAGE_SLUG, slugify } from "@ecommerce-x/shared";
import { api, ApiError } from "@/lib/api";
import { FormLabel } from "@/components/form-label";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

const empty = { title: "", slug: "", content: "", status: "DRAFT", seoTitle: "", seoDescription: "" };

function displaySlug(slug: string): string {
  return slug === HOME_PAGE_SLUG ? "/ (homepage)" : `/${slug}`;
}

export default function CmsPagesAdmin() {
  const router = useRouter();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    // The reserved homepage row (slug __home__) is find-or-created here so
    // it always shows up in this list like any other page — it's edited
    // the same way (builder icon, raw content/SEO, status, delete), the
    // only special case is its slug being locked (see the edit form below).
    try {
      await api.post("/api/pages/home/ensure");
      const all = await api.get<CmsPage[]>("/api/pages?includeDrafts=true");
      setPages(all);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load pages.");
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await api.put(`/api/pages/${editingId}`, form);
      else await api.post("/api/pages", form);
      toast.success(editingId ? "Page updated" : "Page created");
      setForm(empty); setEditingId(null); setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save page. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this page?")) return;
    try {
      await api.delete(`/api/pages/${id}`);
      toast.success("Page deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete page.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pages</h1>
        <button className="btn-primary" onClick={() => { setForm(empty); setEditingId(null); setShowForm((v) => !v); }}><Plus size={16} /> New Page</button>
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        Includes the homepage (first row, locked slug) — build any page visually with drag-and-drop sections, or edit its raw HTML content directly.
      </p>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div><FormLabel required>Title</FormLabel><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <FormLabel>Slug</FormLabel>
            <input
              disabled
              className="input cursor-not-allowed bg-slate-50 text-slate-500"
              value={form.slug === HOME_PAGE_SLUG ? "/ (homepage)" : form.slug || (form.title ? `/${slugify(form.title)}` : "")}
              placeholder="Generated automatically from the title"
            />
          </div>
          <div className="sm:col-span-2"><FormLabel>Content (HTML)</FormLabel><textarea rows={8} className="input font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div><FormLabel>SEO Title</FormLabel><input className="input" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
          <div><FormLabel>Status</FormLabel>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
          <div className="sm:col-span-2"><FormLabel>SEO Description</FormLabel><input className="input" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></div>
          <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
            {saving && <Spinner />} {saving ? "Saving…" : editingId ? "Update Page" : "Create Page"}
          </button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td className="text-slate-500">{displaySlug(p.slug)}</td>
                <td><span className={`badge ${p.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></td>
                <td className="flex gap-2">
                  <button onClick={() => router.push(`/builder/${p.id}`)} title="Edit with drag-and-drop builder" className="text-slate-400 hover:text-brand-600"><LayoutTemplate size={15} /></button>
                  <button onClick={() => { setEditingId(p.id); setForm({ ...p, content: p.content ?? "", seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "" }); setShowForm(true); }} title="Edit raw content/SEO" className="text-slate-400 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(p.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
