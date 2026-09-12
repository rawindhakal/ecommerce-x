"use client";

import { useEffect } from "react";
import { ProductCard } from "@/components/product-card";
import { useWishlistStore } from "@/lib/wishlist-store";

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items);
  const loaded = useWishlistStore((s) => s.loaded);
  const fetchWishlist = useWishlistStore((s) => s.fetchWishlist);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  return (
    <div>
      <h1 className="font-display text-2xl">Wishlist</h1>
      {!loaded ? (
        <p className="mt-6 text-sm text-ink/50">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">Your wishlist is empty. Tap the heart on any product to save it here.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </div>
  );
}
