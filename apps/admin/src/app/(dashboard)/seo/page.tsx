"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Spinner } from "@/components/spinner";
import { toast } from "@/lib/toast-store";

interface Issue {
  id: string;
  name: string;
  slug: string;
  editUrl: string;
}

interface AuditResult {
  score: number;
  counts: { products: number; categories: number; pages: number };
  issues: {
    productsMissingSeoTitle: Issue[];
    productsMissingSeoDescription: Issue[];
    productsMissingImages: Issue[];
    categoriesMissingSeoTitle: Issue[];
    categoriesMissingSeoDescription: Issue[];
    pagesMissingSeoTitle: Issue[];
    pagesMissingSeoDescription: Issue[];
    duplicateProductSlugs: string[];
  };
}

const ISSUE_LABELS: Record<string, string> = {
  productsMissingSeoTitle: "Products missing SEO title",
  productsMissingSeoDescription: "Products missing SEO description",
  productsMissingImages: "Products with no images",
  categoriesMissingSeoTitle: "Categories missing SEO title",
  categoriesMissingSeoDescription: "Categories missing SEO description",
  pagesMissingSeoTitle: "Pages missing SEO title",
  pagesMissingSeoDescription: "Pages missing SEO description",
};

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string | null;
  statusCode: number;
  note: string | null;
  createdAt: string;
}

const emptyRedirect = { fromPath: "", toPath: "", statusCode: 301, note: "" };

export default function SeoPage() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [form, setForm] = useState(emptyRedirect);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadAudit() {
    try {
      setAudit(await api.get<AuditResult>("/api/seo-audit"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load SEO audit.");
    }
  }
  async function loadRedirects() {
    try {
      setRedirects(await api.get<Redirect[]>("/api/redirects"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load redirects.");
    }
  }
  useEffect(() => {
    loadAudit();
    loadRedirects();
  }, []);

  async function submitRedirect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/redirects", {
        fromPath: form.fromPath,
        toPath: form.statusCode === 410 ? null : form.toPath,
        statusCode: Number(form.statusCode),
        note: form.note || undefined,
      });
      toast.success("Redirect saved");
      setForm(emptyRedirect);
      setShowForm(false);
      loadRedirects();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save redirect. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRedirect(id: string) {
    if (!confirm("Delete this redirect?")) return;
    try {
      await api.delete(`/api/redirects/${id}`);
      toast.success("Redirect deleted");
      loadRedirects();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete redirect.");
    }
  }

  const scoreColor = !audit ? "text-slate-400" : audit.score >= 90 ? "text-green-600" : audit.score >= 70 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">SEO</h1>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Site SEO Audit</h2>
          {audit && <span className={`text-3xl font-bold ${scoreColor}`}>{audit.score}</span>}
        </div>

        {!audit ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-3 gap-4 text-center text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-lg font-semibold">{audit.counts.products}</div><div className="text-slate-500">Active Products</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-lg font-semibold">{audit.counts.categories}</div><div className="text-slate-500">Categories</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-lg font-semibold">{audit.counts.pages}</div><div className="text-slate-500">Published Pages</div></div>
            </div>

            <div className="space-y-4">
              {Object.entries(ISSUE_LABELS).map(([key, label]) => {
                const items = audit.issues[key as keyof AuditResult["issues"]] as Issue[];
                if (!items || items.length === 0) return null;
                return (
                  <div key={key}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700">
                      <AlertTriangle size={15} /> {label} ({items.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {items.slice(0, 12).map((it) => (
                        <Link key={it.id} href={it.editUrl} className="badge bg-amber-50 text-amber-700 hover:bg-amber-100">
                          {it.name}
                        </Link>
                      ))}
                      {items.length > 12 && <span className="badge bg-slate-100 text-slate-500">+{items.length - 12} more</span>}
                    </div>
                  </div>
                );
              })}

              {audit.issues.duplicateProductSlugs.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-700">
                    <AlertTriangle size={15} /> Duplicate product slugs ({audit.issues.duplicateProductSlugs.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {audit.issues.duplicateProductSlugs.map((slug) => (
                      <span key={slug} className="badge bg-red-50 text-red-700">{slug}</span>
                    ))}
                  </div>
                </div>
              )}

              {audit.score === 100 && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 size={16} /> No SEO issues found — every active product, category, and published page has its metadata filled in.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Redirects &amp; Gone URLs</h2>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}><Plus size={16} /> New Redirect</button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Deleting a product or category auto-creates a 410 Gone entry here. Add a 301 manually when you rename/merge a URL so search engines and old links land somewhere real instead of a dead page.
        </p>

        {showForm && (
          <form onSubmit={submitRedirect} className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-4 sm:grid-cols-4">
            <input required placeholder="/products/old-slug *" className="input" value={form.fromPath} onChange={(e) => setForm({ ...form, fromPath: e.target.value })} />
            <select className="input" value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: Number(e.target.value) })}>
              <option value={301}>301 — Permanent redirect</option>
              <option value={302}>302 — Temporary redirect</option>
              <option value={410}>410 — Gone</option>
            </select>
            {form.statusCode !== 410 && (
              <input required placeholder="/products/new-slug *" className="input" value={form.toPath} onChange={(e) => setForm({ ...form, toPath: e.target.value })} />
            )}
            <input placeholder="Note (optional)" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button type="submit" disabled={saving} className="btn-primary sm:col-span-4">
              {saving && <Spinner />} {saving ? "Saving…" : "Save Redirect"}
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>From</th><th>To</th><th>Status</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {redirects.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.fromPath}</td>
                  <td className="font-mono text-xs text-slate-500">{r.toPath ?? "—"}</td>
                  <td>
                    <span className={`badge ${r.statusCode === 410 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{r.statusCode}</span>
                  </td>
                  <td className="text-xs text-slate-400">{r.note ?? "—"}</td>
                  <td><button onClick={() => removeRedirect(r.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></td>
                </tr>
              ))}
              {redirects.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400">No redirects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
