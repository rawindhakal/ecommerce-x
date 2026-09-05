"use client";

import { useEffect, useState } from "react";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { api } from "@/lib/api";

interface WishlistItem {
  id: string;
  product: ProductCardData;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    api.get<WishlistItem[]>("/api/wishlist").then(setItems);
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl">Wishlist</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">Your wishlist is empty.</p>
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
