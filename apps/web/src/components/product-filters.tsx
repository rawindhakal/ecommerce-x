"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <select
      className="input w-auto"
      defaultValue={params.get("sort") ?? "newest"}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("sort", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      <option value="newest">Newest</option>
      <option value="price_asc">Price: Low to High</option>
      <option value="price_desc">Price: High to Low</option>
      <option value="rating">Top Rated</option>
    </select>
  );
}

export function BrandFilter({ brands }: { brands: { id: string; name: string; slug: string; logoUrl?: string | null }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("brand");

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Brands</h4>
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              if (active === b.slug) next.delete("brand");
              else next.set("brand", b.slug);
              router.push(`${pathname}?${next.toString()}`);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${active === b.slug ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/70"}`}
          >
            {b.logoUrl && (
              <span className="relative h-4 w-4 flex-shrink-0 overflow-hidden rounded-full bg-white">
                <Image src={imgSrc(b.logoUrl)} alt="" fill unoptimized className="object-contain" />
              </span>
            )}
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Generic multi-select chip filter backed by a comma-separated query param — used for tags and each variant-option facet (shade, size, ...). */
export function MultiChipFilter({ paramKey, label, options }: { paramKey: string; label: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = new Set((params.get(paramKey) ?? "").split(",").filter(Boolean));
  if (options.length === 0) return null;

  function toggle(value: string) {
    const next = new URLSearchParams(params.toString());
    const nextSelected = new Set(selected);
    if (nextSelected.has(value)) nextSelected.delete(value);
    else nextSelected.add(value);
    if (nextSelected.size === 0) next.delete(paramKey);
    else next.set(paramKey, Array.from(nextSelected).join(","));
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1.5 text-xs ${selected.has(opt) ? "border-brand bg-brand text-white" : "border-ink/15 text-ink/70"}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PriceRangeFilter({ min, max }: { min: number; max: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [values, setValues] = useState({
    minPrice: params.get("minPrice") ?? String(min),
    maxPrice: params.get("maxPrice") ?? String(max),
  });

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    const lo = Number(values.minPrice);
    const hi = Number(values.maxPrice);
    if (values.minPrice !== "" && lo > min) next.set("minPrice", String(lo));
    else next.delete("minPrice");
    if (values.maxPrice !== "" && hi < max) next.set("maxPrice", String(hi));
    else next.delete("maxPrice");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  if (min >= max) return null;

  return (
    <form onSubmit={apply} className="space-y-2">
      <h4 className="text-sm font-semibold">Price Range</h4>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          className="input w-full px-2 py-1.5 text-xs"
          value={values.minPrice}
          onChange={(e) => setValues((v) => ({ ...v, minPrice: e.target.value }))}
          aria-label="Minimum price"
        />
        <span className="text-ink/40">–</span>
        <input
          type="number"
          min={min}
          max={max}
          className="input w-full px-2 py-1.5 text-xs"
          value={values.maxPrice}
          onChange={(e) => setValues((v) => ({ ...v, maxPrice: e.target.value }))}
          aria-label="Maximum price"
        />
      </div>
      <button type="submit" className="btn-outline w-full py-1.5 text-xs">Apply</button>
    </form>
  );
}

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (totalPages <= 1) return null;

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <button disabled={page <= 1} onClick={() => go(page - 1)} className="btn-outline px-4 py-2 disabled:opacity-40">
        Previous
      </button>
      <span className="px-3 text-sm text-ink/60">
        Page {page} of {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => go(page + 1)} className="btn-outline px-4 py-2 disabled:opacity-40">
        Next
      </button>
    </div>
  );
}
