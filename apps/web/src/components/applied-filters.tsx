"use client";

import { X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const RESERVED = new Set(["sort", "page", "pageSize", "search"]);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

/** Row of removable chips summarizing every active /products filter, plus a "Clear all". */
export function AppliedFilters({ brands }: { brands: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: URLSearchParams) {
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function removeParam(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    go(next);
  }

  function removeValue(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const remaining = (next.get(key) ?? "").split(",").filter((v) => v && v !== value);
    if (remaining.length) next.set(key, remaining.join(","));
    else next.delete(key);
    go(next);
  }

  const chips: Chip[] = [];

  const minPrice = params.get("minPrice");
  const maxPrice = params.get("maxPrice");
  if (minPrice || maxPrice) {
    chips.push({
      key: "price",
      label: `Price: ${minPrice ?? "0"}–${maxPrice ?? "∞"}`,
      remove: () => {
        const next = new URLSearchParams(params.toString());
        next.delete("minPrice");
        next.delete("maxPrice");
        go(next);
      },
    });
  }

  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key) || key === "minPrice" || key === "maxPrice") continue;
    if (key === "brand") {
      const b = brands.find((x) => x.slug === value);
      chips.push({ key, label: `Brand: ${b?.name ?? value}`, remove: () => removeParam(key) });
      continue;
    }
    if (key === "category") continue; // shown via breadcrumb/page context, not a removable facet here
    for (const v of value.split(",").filter(Boolean)) {
      chips.push({ key: `${key}:${v}`, label: `${key === "tags" ? "Tag" : capitalize(key)}: ${v}`, remove: () => removeValue(key, v) });
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={chip.remove}
          className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 hover:border-brand hover:text-brand"
        >
          {chip.label}
          <X size={12} />
        </button>
      ))}
      <button onClick={() => router.push(pathname)} className="text-xs font-medium text-ink/50 underline hover:text-brand">
        Clear all
      </button>
    </div>
  );
}
