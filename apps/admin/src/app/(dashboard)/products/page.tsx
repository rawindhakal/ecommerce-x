"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Product {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePrice: string;
  category: { name: string } | null;
  brand: { name: string } | null;
  images: { url: string }[];
  variants: { inventory: { quantityOnHand: number }[] }[];
}

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

function ProductThumb({ product }: { product: Product }) {
  const url = product.images[0]?.url;
  if (!url) {
    return <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">No img</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imgSrc(url)} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg border border-slate-200 object-cover" />;
}

export default function ProductsPage() {
  const [result, setResult] = useState<PaginatedResult<Product> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const qs = new URLSearchParams({ pageSize: "20" });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    setResult(await api.get<PaginatedResult<Product>>(`/api/products/admin?${qs.toString()}`));
  }

  // Live search: debounce as-you-type so results update without needing Enter.
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [search, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/products/new" className="btn-primary"><Plus size={16} /> New Product</Link>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="table-base">
          <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
          <tbody>
            {result?.items.map((p) => {
              const stock = p.variants.reduce((sum, v) => sum + v.inventory.reduce((s, i) => s + i.quantityOnHand, 0), 0);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3 font-medium text-brand-600 hover:underline">
                      <ProductThumb product={p} />
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-slate-500">{p.category?.name ?? "—"}</td>
                  <td className="text-slate-500">{p.brand?.name ?? "—"}</td>
                  <td>{formatNpr(p.basePrice)}</td>
                  <td className={stock <= 5 ? "text-red-500" : ""}>{stock}</td>
                  <td><span className="badge bg-slate-100 text-slate-600">{p.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {result?.items.map((p) => {
          const stock = p.variants.reduce((sum, v) => sum + v.inventory.reduce((s, i) => s + i.quantityOnHand, 0), 0);
          return (
            <Link key={p.id} href={`/products/${p.id}`} className="card flex gap-3 p-4">
              <ProductThumb product={p} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium text-brand-600">{p.name}</span>
                  <span className="badge bg-slate-100 text-slate-600">{p.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{p.category?.name ?? "—"} {p.brand?.name ? `· ${p.brand.name}` : ""}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className={stock <= 5 ? "font-medium text-red-500" : "text-slate-500"}>{stock} in stock</span>
                  <span className="font-semibold">{formatNpr(p.basePrice)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
