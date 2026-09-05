"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatNpr } from "@/lib/format";

export function CartDrawer() {
  const { cart, isOpen, setOpen, fetchCart, updateItem, removeItem } = useCartStore();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="font-display text-lg">Your Bag ({cart?.items.length ?? 0})</h2>
          <button onClick={() => setOpen(false)} aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.items.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink/50">Your bag is empty.</p>
          ) : (
            <ul className="space-y-4">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-blush">
                    {item.product.images[0] && (
                      <Image
                        src={
                          item.product.images[0].url.startsWith("http")
                            ? item.product.images[0].url
                            : `${process.env.NEXT_PUBLIC_API_URL}${item.product.images[0].url}`
                        }
                        alt={item.product.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    {item.variant.name && <p className="text-xs text-ink/50">{item.variant.name}</p>}
                    <p className="mt-1 text-sm font-semibold">{formatNpr(item.variant.price)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15"
                        onClick={() => updateItem(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15"
                        onClick={() => updateItem(item.id, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </button>
                      <button className="ml-auto text-ink/40 hover:text-red-500" onClick={() => removeItem(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="border-t border-ink/10 px-5 py-4">
            <div className="flex justify-between text-sm text-ink/60">
              <span>Subtotal</span>
              <span>{formatNpr(cart.totals.subtotal)}</span>
            </div>
            {cart.totals.discount > 0 && (
              <div className="flex justify-between text-sm text-brand">
                <span>Discount</span>
                <span>-{formatNpr(cart.totals.discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatNpr(cart.totals.total)}</span>
            </div>
            <Link href="/checkout" onClick={() => setOpen(false)} className="btn-primary mt-4 w-full">
              Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
