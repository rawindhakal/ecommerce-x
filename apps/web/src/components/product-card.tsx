"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { formatNpr } from "@/lib/format";
import { useCartStore } from "@/lib/cart-store";
import { trackEvent } from "@/lib/track";
import { useState } from "react";
import { imgSrc, isSvg } from "@/lib/image";

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  compareAtPrice?: string | null;
  avgRating: string;
  reviewCount: number;
  images: { url: string; altText: string | null }[];
  variants: { id: string; price: string }[];
}

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = useState(false);
  const image = product.images[0]?.url;
  const firstVariant = product.variants[0];

  async function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (!firstVariant) return;
    setAdding(true);
    try {
      await addItem(firstVariant.id, 1);
      trackEvent("add_to_cart", {
        ecommerce: { items: [{ item_id: product.id, item_name: product.name, price: Number(firstVariant.price) }] },
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-blush">
        {image ? (
          <Image
            src={imgSrc(image)}
            alt={product.images[0]?.altText ?? product.name}
            fill
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized={isSvg(image)}
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink/30">No image</div>
        )}
        {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.basePrice) && (
          <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-white">
            -{Math.round((1 - Number(product.basePrice) / Number(product.compareAtPrice)) * 100)}%
          </span>
        )}
        <button
          type="button"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink/70 opacity-0 shadow transition group-hover:opacity-100 hover:text-brand"
          aria-label="Add to wishlist"
        >
          <Heart size={16} />
        </button>
        <button
          type="button"
          onClick={quickAdd}
          disabled={adding || !firstVariant}
          className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-2 rounded-full bg-ink/90 py-2.5 text-xs font-semibold text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 disabled:opacity-50"
        >
          <ShoppingBag size={14} />
          {adding ? "Adding…" : "Quick Add"}
        </button>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="truncate text-sm font-medium text-ink">{product.name}</h3>
        <div className="flex items-center gap-1 text-xs text-ink/50">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          {Number(product.avgRating).toFixed(1)} ({product.reviewCount})
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{formatNpr(product.basePrice)}</span>
          {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.basePrice) && (
            <span className="text-xs text-ink/40 line-through">{formatNpr(product.compareAtPrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
