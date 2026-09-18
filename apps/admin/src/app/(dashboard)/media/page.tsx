"use client";

import { useEffect, useState } from "react";
import { Search, Upload, Trash2, X, Copy, Check } from "lucide-react";
import { api, uploadFile, API_URL } from "@/lib/api";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  altText: string | null;
  createdAt: string;
}

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [copied, setCopied] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<PaginatedResult<MediaItem>>(`/api/media?search=${encodeURIComponent(search)}&page=${page}&pageSize=48`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) await uploadFile(file);
      setPage(1);
      setSearch("");
      load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function openDetail(item: MediaItem) {
    setSelected(item);
    setAltDraft(item.altText ?? "");
    setCopied(false);
  }

  async function saveAltText() {
    if (!selected) return;
    const updated = await api.put<MediaItem>(`/api/media/${selected.id}`, { altText: altDraft || null });
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelected(updated);
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Remove "${item.filename}" from the library? Any place it's already used elsewhere won't be affected.`)) return;
    await api.delete(`/api/media/${item.id}`);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setTotal((t) => t - 1);
    if (selected?.id === item.id) setSelected(null);
  }

  function copyUrl(item: MediaItem) {
    navigator.clipboard.writeText(imgSrc(item.url));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Media Library</h1>
          <p className="text-sm text-slate-500">{total} file{total !== 1 ? "s" : ""} — every upload across the admin lands here automatically and can be reused anywhere.</p>
        </div>
        <label className="btn-primary cursor-pointer">
          <Upload size={16} /> {uploading ? "Uploading…" : "Upload"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Search files…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="card p-4">
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No files yet — upload one to get started.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetail(item)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-100"
              >
                <img src={imgSrc(item.url)} alt={item.altText ?? item.filename} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                  {item.filename}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-outline px-4 py-2 disabled:opacity-40">Previous</button>
          <span className="px-3 text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-outline px-4 py-2 disabled:opacity-40">Next</button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">File details</h3>
              <button onClick={() => setSelected(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <img src={imgSrc(selected.url)} alt={selected.altText ?? selected.filename} className="max-h-64 w-full rounded-lg border border-slate-100 object-contain bg-slate-50" />
            <p className="mt-3 truncate text-sm font-medium text-slate-700">{selected.filename}</p>
            <p className="text-xs text-slate-400">{selected.mimeType} · {formatSize(selected.size)}</p>
            <div className="mt-3">
              <label className="label">Alt Text</label>
              <input className="input" value={altDraft} onChange={(e) => setAltDraft(e.target.value)} onBlur={saveAltText} placeholder="Describe this image" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => copyUrl(selected)} className="btn-outline flex-1">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy URL"}
              </button>
              <button onClick={() => remove(selected)} className="btn-danger flex-1"><Trash2 size={14} /> Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
