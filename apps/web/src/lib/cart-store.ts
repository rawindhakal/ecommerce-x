import { create } from "zustand";
import { api } from "./api";

export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  quantity: number;
  product: { name: string; slug: string; images: { url: string }[] };
  variant: { name: string | null; price: string; sku: string; options: Record<string, string> };
}

export interface Cart {
  id: string;
  items: CartItem[];
  coupon: { code: string; type: string; value: string } | null;
  totals: { subtotal: number; discount: number; total: number };
}

interface CartState {
  cart: Cart | null;
  loading: boolean;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  fetchCart: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  loading: false,
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),

  fetchCart: async () => {
    set({ loading: true });
    try {
      const cart = await api.get<Cart>("/api/cart");
      set({ cart });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (variantId, quantity = 1) => {
    const cart = await api.post<Cart>("/api/cart/items", { variantId, quantity });
    set({ cart, isOpen: true });
  },

  updateItem: async (itemId, quantity) => {
    const cart = await api.put<Cart>(`/api/cart/items/${itemId}`, { quantity });
    set({ cart });
  },

  removeItem: async (itemId) => {
    const cart = await api.delete<Cart>(`/api/cart/items/${itemId}`);
    set({ cart });
  },

  applyCoupon: async (code) => {
    const cart = await api.post<Cart>("/api/cart/coupon", { code });
    set({ cart });
  },

  removeCoupon: async () => {
    const cart = await api.delete<Cart>("/api/cart/coupon");
    set({ cart });
  },
}));
