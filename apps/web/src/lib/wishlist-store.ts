import { create } from "zustand";
import { api, ApiError } from "./api";
import { toast } from "./toast-store";
import type { ProductCardData } from "@/components/product-card";

interface WishlistItem {
  id: string;
  productId: string;
  product: ProductCardData;
}

interface WishlistState {
  items: WishlistItem[];
  ids: Set<string>;
  loaded: boolean;
  fetchWishlist: () => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  toggle: (product: ProductCardData) => Promise<void>;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  ids: new Set(),
  loaded: false,

  fetchWishlist: async () => {
    try {
      const items = await api.get<WishlistItem[]>("/api/wishlist");
      set({ items, ids: new Set(items.map((i) => i.productId)), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  isWishlisted: (productId) => get().ids.has(productId),

  toggle: async (product) => {
    const wasWishlisted = get().ids.has(product.id);

    // Optimistic update so the heart flips instantly; rolled back on failure.
    if (wasWishlisted) {
      set((s) => ({
        items: s.items.filter((i) => i.productId !== product.id),
        ids: new Set([...s.ids].filter((id) => id !== product.id)),
      }));
    } else {
      set((s) => ({
        items: [...s.items, { id: `pending-${product.id}`, productId: product.id, product }],
        ids: new Set(s.ids).add(product.id),
      }));
    }

    try {
      if (wasWishlisted) {
        await api.delete(`/api/wishlist/${product.id}`);
        toast.success("Removed from wishlist");
      } else {
        await api.post("/api/wishlist", { productId: product.id });
        toast.success("Added to wishlist");
      }
    } catch (err) {
      // Roll back the optimistic change.
      if (wasWishlisted) {
        set((s) => ({ items: [...s.items, { id: `pending-${product.id}`, productId: product.id, product }], ids: new Set(s.ids).add(product.id) }));
      } else {
        set((s) => ({ items: s.items.filter((i) => i.productId !== product.id), ids: new Set([...s.ids].filter((id) => id !== product.id)) }));
      }
      toast.error(err instanceof ApiError ? err.message : "Couldn't update your wishlist. Please try again.");
    }
  },
}));
