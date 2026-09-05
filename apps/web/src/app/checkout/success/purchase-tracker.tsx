"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track";
import { useCartStore } from "@/lib/cart-store";

export function PurchaseTracker({ orderId, orderNumber, total }: { orderId: string; orderNumber: string; total: number }) {
  const fetchCart = useCartStore((s) => s.fetchCart);

  useEffect(() => {
    trackEvent("purchase", { ecommerce: { transaction_id: orderNumber, value: total, currency: "NPR" } });
    fetchCart();
  }, [orderId, orderNumber, total, fetchCart]);

  return null;
}
