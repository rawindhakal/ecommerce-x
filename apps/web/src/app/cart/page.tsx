"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatNpr } from "@/lib/format";

export default function CartPage() {
  const { cart, fetchCart, updateItem, removeItem, applyCoupon, removeCoupon } = useCartStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return (
    <div className="container-x py-10">
      <h1 className="font-display text-3xl">Your Bag</h1>

      {!cart || cart.items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-ink/50">Your bag is empty.</p>
          <Link href="/products" className="btn-primary mt-6 inline-flex">Continue Shopping</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-6">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-4 border-b border-ink/10 pb-6">
                <div className="relative h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-blush">
                  {item.product.images[0] && (
                    <Image
                      src={item.product.images[0].url.startsWith("http") ? item.product.images[0].url : `${process.env.NEXT_PUBLIC_API_URL}${item.product.images[0].url}`}
                      alt={item.product.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <Link href={`/products/${item.product.slug}`} className="font-medium hover:text-brand">
                    {item.product.name}
                  </Link>
                  {item.variant.name && <p className="text-sm text-ink/50">{item.variant.name}</p>}
                  <p className="mt-1 font-semibold">{formatNpr(item.variant.price)}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center rounded-full border border-ink/15">
                      <button className="p-2" onClick={() => updateItem(item.id, Math.max(0, item.quantity - 1))}><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button className="p-2" onClick={() => updateItem(item.id, item.quantity + 1)}><Plus size={14} /></button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-ink/40 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="card h-fit p-6">
            <h2 className="font-display text-lg">Order Summary</h2>

            <div className="mt-4 flex gap-2">
              <input className="input" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button
                className="btn-outline whitespace-nowrap"
                onClick={async () => {
                  setError(null);
                  try {
                    await applyCoupon(code);
                  } catch (err: any) {
                    setError(err.message ?? "Invalid coupon");
                  }
                }}
              >
                Apply
              </button>
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {cart.coupon && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Coupon "{cart.coupon.code}" applied</span>
                <button onClick={() => removeCoupon()} className="text-brand underline">Remove</button>
              </div>
            )}

            <div className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between text-ink/60">
                <span>Subtotal</span>
                <span>{formatNpr(cart.totals.subtotal)}</span>
              </div>
              {cart.totals.discount > 0 && (
                <div className="flex justify-between text-brand">
                  <span>Discount</span>
                  <span>-{formatNpr(cart.totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Estimated Total</span>
                <span>{formatNpr(cart.totals.total)}</span>
              </div>
              <p className="text-xs text-ink/40">Shipping calculated at checkout</p>
            </div>

            <Link href="/checkout" className="btn-primary mt-5 w-full">Proceed to Checkout</Link>
          </div>
        </div>
      )}
    </div>
  );
}
