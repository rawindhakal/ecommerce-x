"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { api, ApiError } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import { trackEvent } from "@/lib/track";
import { NEPAL_PROVINCES, sanitizePhoneInput } from "@ecommerce-x/shared";

interface PaymentSettings {
  payments: Record<string, { enabled: boolean; mode: string }>;
}

interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  payment: {
    gateway: string;
    mode: "REDIRECT_FORM" | "QR" | "COD";
    redirectUrl?: string;
    formFields?: Record<string, string>;
    qrPayload?: string;
    referenceId: string;
  };
}

const GATEWAY_LABELS: Record<string, string> = {
  esewa: "eSewa",
  fonepay: "Fonepay (QR)",
  cybersource_nicasia: "Card (NIC Asia)",
  cod: "Cash on Delivery",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, fetchCart } = useCartStore();
  const { user, fetchMe, initialized } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);
  const [gateways, setGateways] = useState<Record<string, { enabled: boolean }>>({});
  const [gateway, setGateway] = useState<string>("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectForm, setRedirectForm] = useState<{ url: string; fields: Record<string, string> } | null>(null);

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    province: "Bagmati",
    district: "Kathmandu",
    municipality: "",
    ward: "",
    street: "",
    landmark: "",
  });

  useEffect(() => {
    fetchCart();
    if (!initialized) fetchMe();
    api.get<PaymentSettings>("/api/settings/public").then((s) => setGateways(s.payments as any));
  }, [fetchCart, fetchMe, initialized]);

  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, customerName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(), customerPhone: user.phone ?? f.customerPhone, customerEmail: user.email ?? "" }));
    }
  }, [user]);

  useEffect(() => {
    if (redirectForm && formRef.current) {
      formRef.current.submit();
    }
  }, [redirectForm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      trackEvent("begin_checkout", { ecommerce: { value: cart?.totals.total, currency: "NPR" } });
      const res = await api.post<CheckoutResponse>("/api/orders/checkout", {
        customerName: form.customerName,
        customerEmail: form.customerEmail || undefined,
        customerPhone: form.customerPhone,
        shippingAddress: {
          fullName: form.customerName,
          phone: form.customerPhone,
          province: form.province,
          district: form.district,
          municipality: form.municipality,
          ward: form.ward || undefined,
          street: form.street || undefined,
          landmark: form.landmark || undefined,
        },
        gateway: gateway.toUpperCase(),
      });

      if (res.payment.mode === "COD") {
        router.push(`/checkout/success?orderId=${res.orderId}`);
        return;
      }
      if (res.payment.mode === "REDIRECT_FORM" && res.payment.redirectUrl && res.payment.formFields) {
        setRedirectForm({ url: res.payment.redirectUrl, fields: res.payment.formFields });
        return;
      }
      if (res.payment.mode === "QR") {
        router.push(`/checkout/pay/${res.paymentId}?orderId=${res.orderId}`);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (redirectForm) {
    return (
      <div className="container-x py-24 text-center">
        <p className="text-ink/60">Redirecting you to complete payment…</p>
        <form ref={formRef} method="POST" action={redirectForm.url} className="hidden">
          {Object.entries(redirectForm.fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-x py-24 text-center text-ink/50">
        Your bag is empty. <a href="/products" className="text-brand underline">Continue shopping</a>
      </div>
    );
  }

  return (
    <div className="container-x py-10">
      <h1 className="font-display text-3xl">Checkout</h1>
      <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="mb-4 font-display text-lg">Contact & Delivery</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full Name</label>
                <input required className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} required className="input" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: sanitizePhoneInput(e.target.value) })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email (optional)</label>
                <input type="email" className="input" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
              </div>
              <div>
                <label className="label">Province</label>
                <select className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
                  {NEPAL_PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">District</label>
                <input required className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
              </div>
              <div>
                <label className="label">Municipality / City</label>
                <input required className="input" value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} />
              </div>
              <div>
                <label className="label">Ward No. (optional)</label>
                <input className="input" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Street Address</label>
                <input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Landmark (optional)</label>
                <input className="input" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 font-display text-lg">Payment Method</h2>
            <div className="space-y-2">
              {Object.entries(GATEWAY_LABELS).map(([key, label]) => {
                const enabled = gateways[key]?.enabled;
                if (!enabled) return null;
                return (
                  <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${gateway === key ? "border-brand bg-brand/5" : "border-ink/10"}`}>
                    <input type="radio" name="gateway" checked={gateway === key} onChange={() => setGateway(key)} />
                    {label}
                  </label>
                );
              })}
            </div>
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="card h-fit p-6">
          <h2 className="mb-4 font-display text-lg">Order Summary</h2>
          <ul className="max-h-72 space-y-3 overflow-y-auto text-sm">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span className="text-ink/70">{item.product.name} × {item.quantity}</span>
                <span>{formatNpr(Number(item.variant.price) * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between text-ink/60"><span>Subtotal</span><span>{formatNpr(cart.totals.subtotal)}</span></div>
            {cart.totals.discount > 0 && <div className="flex justify-between text-brand"><span>Discount</span><span>-{formatNpr(cart.totals.discount)}</span></div>}
            <p className="text-xs text-ink/40">Shipping calculated on order confirmation</p>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary mt-5 w-full">
            {submitting ? "Placing Order…" : "Place Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
