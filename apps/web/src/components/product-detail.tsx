"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Heart, Star } from "lucide-react";
import { formatNpr } from "@/lib/format";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { toast } from "@/lib/toast-store";
import { trackEvent } from "@/lib/track";
import { imgSrc, isSvg } from "@/lib/image";

interface Variant {
  id: string;
  name: string | null;
  options: Record<string, string>;
  price: string;
  compareAtPrice: string | null;
  imageUrl: string | null;
  inventory: { quantityOnHand: number; quantityReserved: number }[];
}

interface Props {
  productId: string;
  productName: string;
  productSlug: string;
  basePrice: string;
  avgRating: string;
  reviewCount: number;
  images: { url: string; altText: string | null }[];
  variants: Variant[];
  brand?: { name: string; slug: string; logoUrl: string | null } | null;
}

export function ProductDetail({ productId, productName, productSlug, basePrice, avgRating, reviewCount, images, variants, brand }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const wishlisted = useWishlistStore((s) => s.ids.has(productId));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const optionKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((v) => Object.keys(v.options).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [variants]);

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (variants[0]) Object.assign(initial, variants[0].options);
    return initial;
  });
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const activeVariant =
    variants.find((v) => optionKeys.every((k) => v.options[k] === selected[k])) ?? variants[0];

  const stock = activeVariant?.inventory.reduce((sum, i) => sum + (i.quantityOnHand - i.quantityReserved), 0) ?? 0;
  const addCartItem = useCartStore((s) => s.addItem);

  async function handleAddToCart() {
    if (!activeVariant) return;
    setAdding(true);
    try {
      await addCartItem(activeVariant.id, qty);
      trackEvent("add_to_cart", {
        ecommerce: { items: [{ item_id: productId, item_name: productName, price: Number(activeVariant.price), quantity: qty }] },
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
  }

  async function handleWishlistToggle() {
    if (!user) {
      toast.info("Sign in to save items to your wishlist");
      router.push("/account/login");
      return;
    }
    setTogglingWishlist(true);
    try {
      await toggleWishlist({
        id: productId,
        name: productName,
        slug: productSlug,
        basePrice,
        avgRating,
        reviewCount,
        images,
        variants: variants.map((v) => ({ id: v.id, price: v.price })),
      });
      if (!wishlisted) {
        trackEvent("add_to_wishlist", { ecommerce: { items: [{ item_id: productId, item_name: productName }] } });
      }
    } finally {
      setTogglingWishlist(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-blush">
          {images[activeImage] && (
            <Image
              src={imgSrc(images[activeImage].url)}
              alt={images[activeImage].altText ?? productName}
              fill
              // This is the PDP's LCP element: priority disables lazy-loading
              // and has Next inject a <link rel="preload"> for it automatically.
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized={isSvg(images[activeImage].url)}
              className="object-cover"
            />
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {images.map((img, idx) => (
              <button
                key={img.url}
                onClick={() => setActiveImage(idx)}
                className={`relative h-16 w-16 overflow-hidden rounded-lg border ${idx === activeImage ? "border-brand" : "border-ink/10"}`}
              >
                <Image src={imgSrc(img.url)} alt="" fill unoptimized={isSvg(img.url)} sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {brand && (
          <Link href={`/products?brand=${brand.slug}`} className="mb-2 flex items-center gap-2 text-sm font-medium text-ink/60 hover:text-brand">
            {brand.logoUrl && (
              <span className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-ink/10 bg-white">
                <Image src={imgSrc(brand.logoUrl)} alt="" fill unoptimized={isSvg(brand.logoUrl)} sizes="24px" className="object-contain" />
              </span>
            )}
            {brand.name}
          </Link>
        )}
        <h1 className="font-display text-3xl">{productName}</h1>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-2xl font-semibold">{formatNpr(activeVariant?.price ?? 0)}</span>
          {activeVariant?.compareAtPrice && Number(activeVariant.compareAtPrice) > Number(activeVariant.price) && (
            <span className="text-base text-ink/40 line-through">{formatNpr(activeVariant.compareAtPrice)}</span>
          )}
        </div>

        {optionKeys.map((key) => {
          const values = Array.from(new Set(variants.map((v) => v.options[key]).filter(Boolean)));
          return (
            <div key={key} className="mt-5">
              <span className="label capitalize">{key}: {selected[key]}</span>
              <div className="flex flex-wrap gap-2">
                {values.map((val) => (
                  <button
                    key={val}
                    onClick={() => setSelected((s) => ({ ...s, [key]: val! }))}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      selected[key] === val ? "border-brand bg-brand/10 text-brand" : "border-ink/15 text-ink/70 hover:border-ink/30"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center rounded-full border border-ink/15">
            <button className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm">{qty}</span>
            <button className="p-3" onClick={() => setQty((q) => Math.min(stock || 99, q + 1))}>
              <Plus size={14} />
            </button>
          </div>
          <span className="text-xs text-ink/50">{stock > 0 ? `${stock} in stock` : "Out of stock"}</span>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={handleAddToCart} disabled={adding || stock === 0} className="btn-primary flex-1">
            <ShoppingBag size={16} />
            {stock === 0 ? "Out of Stock" : added ? "Added!" : adding ? "Adding…" : "Add to Bag"}
          </button>
          <button
            onClick={handleWishlistToggle}
            disabled={togglingWishlist}
            className={`btn-outline px-4 disabled:cursor-wait ${wishlisted ? "border-brand text-brand" : ""}`}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wishlisted}
          >
            <Heart size={16} className={wishlisted ? "fill-brand" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
