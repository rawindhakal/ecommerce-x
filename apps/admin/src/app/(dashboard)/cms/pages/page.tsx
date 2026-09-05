"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

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

export default function CmsPagesAdmin() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setPages(await api.get<CmsPage[]>("/api/pages?includeDrafts=true"));
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) await api.put(`/api/pages/${editingId}`, form);
    else await api.post("/api/pages", form);
    setForm(empty); setEditingId(null); setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this page?")) return;
    await api.delete(`/api/pages/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pages</h1>
        <button className="btn-primary" onClick={() => { setForm(empty); setEditingId(null); setShowForm((v) => !v); }}><Plus size={16} /> New Page</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div><label className="label">Title</label><input required className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Slug</label><input required className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Content (HTML)</label><textarea rows={8} className="input font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div><label className="label">SEO Title</label><input className="input" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">SEO Description</label><input className="input" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></div>
          <button type="submit" className="btn-primary sm:col-span-2">{editingId ? "Update" : "Create"} Page</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td className="text-slate-500">/{p.slug}</td>
                <td><span className={`badge ${p.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></td>
                <td className="flex gap-2">
                  <button onClick={() => { setEditingId(p.id); setForm({ ...p, content: p.content ?? "", seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "" }); setShowForm(true); }} className="text-slate-400 hover:text-brand-600"><Pencil size={15} /></button>
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
