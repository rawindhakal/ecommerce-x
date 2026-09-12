"use client";

import { API_URL } from "@/lib/api";
import { formatNpr } from "@/lib/format";

export interface PosVariant {
  id: string;
  sku: string;
  name: string | null;
  price: string;
  options: Record<string, string>;
  product: { name: string; images: { url: string }[] };
  inventory: { quantityOnHand: number; quantityReserved: number }[];
}

function imgSrc(url: string) {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

export function stockOf(v: PosVariant) {
  return v.inventory.reduce((sum, i) => sum + (i.quantityOnHand - i.quantityReserved), 0);
}

export function PosProductGrid({ variants, onSelect }: { variants: PosVariant[]; onSelect: (v: PosVariant) => void }) {
  if (variants.length === 0) {
    return <p className="py-16 text-center text-sm text-[var(--pos-text-40)]">No products found.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {variants.map((v) => {
        const stock = stockOf(v);
        const out = stock <= 0;
        return (
          <button
            key={v.id}
            onClick={() => !out && onSelect(v)}
            disabled={out}
            className="group flex touch-manipulation flex-col overflow-hidden rounded-xl border border-[var(--pos-line)] bg-[var(--pos-surface)] text-left transition active:scale-[0.97] disabled:opacity-40"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-[var(--pos-surface-strong)]">
              {v.product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc(v.product.images[0].url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-[var(--pos-text-30)]">No image</div>
              )}
              {out && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Out of stock
                </span>
              )}
            </div>
            <div className="flex-1 px-2.5 py-2">
              <p className="line-clamp-1 text-xs font-semibold text-[var(--pos-text)]">{v.product.name}</p>
              {v.name && <p className="line-clamp-1 text-[11px] text-[var(--pos-text-50)]">{v.name}</p>}
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--pos-text)]">{formatNpr(v.price)}</span>
                <span className="text-[10px] text-[var(--pos-text-40)]">{stock} left</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
