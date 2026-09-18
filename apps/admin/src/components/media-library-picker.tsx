"use client";

import { useEffect, useState } from "react";
import { Search, Upload, Check, Trash2, X } from "lucide-react";
import { api, uploadFile, API_URL } from "@/lib/api";
import type { PaginatedResult } from "@ecommerce-x/shared";

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  altText: string | null;
  createdAt: string;
}

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

/**
 * Modal for browsing/reusing previously uploaded files (every upload
 * anywhere in the admin becomes a Media row automatically — see
 * apps/api/src/modules/uploads/uploads.routes.ts) as well as uploading new
 * ones. Used both by the standalone "Media Library" admin page and as a
 * "Browse Library" picker embedded in other forms (products, banners,
 * brand/category images, site branding).
 */
export function MediaLibraryPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: MediaItem[]) => void;
  multiple?: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSelectedIds(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<PaginatedResult<MediaItem>>(`/api/media?search=${encodeURIComponent(search)}&page=${page}&pageSize=40`)
        .then((res) => {
          setItems(res.items);
          setTotalPages(res.totalPages);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, search, page]);

  if (!open) return null;

  function toggle(item: MediaItem) {
    if (!multiple) {
      onSelect([item]);
      onClose();
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of files) {
        const url = await uploadFile(file);
        uploaded.push({ id: url, url, filename: file.name, altText: null, createdAt: new Date().toISOString() });
      }
      if (!multiple) {
        onSelect([uploaded[0]!]);
        onClose();
        return;
      }
      setSearch("");
      setPage(1);
      const res = await api.get<PaginatedResult<MediaItem>>("/api/media?page=1&pageSize=40");
      setItems(res.items);
      setTotalPages(res.totalPages);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(item: MediaItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove "${item.filename}" from the library? This won't affect places it's already used.`)) return;
    await api.delete(`/api/media/${item.id}`);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  function confirmMultiple() {
    onSelect(items.filter((i) => selectedIds.has(i.id)));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-lg font-semibold text-slate-900">Media Library</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search files…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <label className="btn-outline cursor-pointer whitespace-nowrap">
            <Upload size={14} /> {uploading ? "Uploading…" : "Upload New"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-16 text-center text-sm text-slate-400">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No files yet — upload one to get started.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {items.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`group relative aspect-square overflow-hidden rounded-lg border-2 ${selected ? "border-brand-500" : "border-transparent"}`}
                  >
                    <img src={imgSrc(item.url)} alt={item.altText ?? item.filename} className="h-full w-full object-cover" />
                    {selected && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                        <Check size={12} />
                      </span>
                    )}
                    <span
                      onClick={(e) => handleDelete(item, e)}
                      role="button"
                      className="absolute left-1 top-1 hidden rounded-full bg-white/90 p-1 text-red-500 group-hover:flex"
                    >
                      <Trash2 size={12} />
                    </span>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {item.filename}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-outline px-2 py-1 text-xs disabled:opacity-40">Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-outline px-2 py-1 text-xs disabled:opacity-40">Next</button>
          </div>
          {multiple && (
            <button onClick={confirmMultiple} disabled={selectedIds.size === 0} className="btn-primary disabled:opacity-40">
              Use {selectedIds.size || ""} Selected
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
