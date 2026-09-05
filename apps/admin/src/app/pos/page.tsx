"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Barcode,
  Minus,
  Plus,
  Clock,
  ArrowLeft,
  UserPlus,
  X,
  Printer,
  PauseCircle,
  PlayCircle,
  LayoutDashboard,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatNpr } from "@/lib/format";
import { Receipt80mm, type ReceiptData } from "@/components/receipt-80mm";
import { PosProductGrid, stockOf, type PosVariant } from "@/components/pos-product-grid";

interface Location { id: string; name: string; type: string }
interface Session { id: string; locationId: string; openingBalance: string; openedAt: string; location: Location }

interface BasketItem {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  price: number;
  quantity: number;
  taxRate: number;
}

interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
}

interface LoyaltyRule {
  isActive: boolean;
  earnPointsPerNpr: number;
  redeemPointValue: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
}

interface StoreSettings {
  branding?: { siteName?: string };
  contact?: { phone?: string; address?: string };
}

interface HeldSale {
  id: string;
  label: string;
  items: BasketItem[];
  customer: Customer | null;
  discountTotal: string;
}

function toBasketItem(v: PosVariant): BasketItem {
  return {
    variantId: v.id,
    sku: v.sku,
    productName: v.product.name,
    variantName: v.name,
    price: Number(v.price),
    quantity: 1,
    taxRate: v.product.taxable ? Number(v.product.taxRate?.rate ?? 0) : 0,
  };
}

export default function PosPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [openingBalance, setOpeningBalance] = useState("1000");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [settings, setSettings] = useState<StoreSettings>({});
  const [loyaltyRule, setLoyaltyRule] = useState<LoyaltyRule | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mobileView, setMobileView] = useState<"menu" | "cart">("menu");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosVariant[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", phone: "" });
  const [redeemPoints, setRedeemPoints] = useState("");

  const [editingDiscount, setEditingDiscount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [tendered, setTendered] = useState("");
  const [discountTotal, setDiscountTotal] = useState("0");
  const [processing, setProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const [showFinalBill, setShowFinalBill] = useState(false);
  const [billTo, setBillTo] = useState({ name: "", phone: "" });

  const [showCloseSession, setShowCloseSession] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  const [closingBalance, setClosingBalance] = useState("");
  const [closeResult, setCloseResult] = useState<any>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Session>("/api/pos/sessions/current").then(setSession);
    api.get<Location[]>("/api/locations").then((locs) => {
      setLocations(locs);
      const store = locs.find((l) => l.type === "STORE");
      if (store) setSelectedLocation(store.id);
    });
    api.get<StoreSettings>("/api/settings/public").then(setSettings);
    api.get<LoyaltyRule>("/api/loyalty/rules").then(setLoyaltyRule);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Browse grid / live search (debounced) — empty query returns a browsable menu.
  useEffect(() => {
    const t = setTimeout(() => {
      api.get<PosVariant[]>(`/api/pos/search?q=${encodeURIComponent(query.trim())}`).then(setResults);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (phoneQuery.trim().length < 3) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.get<Customer[]>(`/api/pos/customers?phone=${encodeURIComponent(phoneQuery.trim())}`).then(setCustomerResults);
    }, 250);
    return () => clearTimeout(t);
  }, [phoneQuery]);

  useEffect(() => {
    if (!receiptData) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [receiptData]);

  async function openSession(e: React.FormEvent) {
    e.preventDefault();
    const s = await api.post<Session>("/api/pos/sessions/open", { locationId: selectedLocation, openingBalance: Number(openingBalance) });
    setSession(s);
  }

  function addVariantToBasket(v: PosVariant) {
    const stock = stockOf(v);
    setError(null);
    setBasket((prev) => {
      const existing = prev.find((b) => b.variantId === v.id);
      const nextQty = (existing?.quantity ?? 0) + 1;
      if (nextQty > stock) {
        setError(`"${v.product.name}" only has ${stock} left in stock`);
        return prev;
      }
      if (existing) return prev.map((b) => (b.variantId === v.id ? { ...b, quantity: nextQty } : b));
      return [...prev, toBasketItem(v)];
    });
  }

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const v = await api.get<PosVariant>(`/api/pos/lookup/${encodeURIComponent(barcodeInput.trim())}`);
      addVariantToBasket(v);
    } catch {
      setError(`No product found for "${barcodeInput}"`);
    }
    setBarcodeInput("");
    barcodeRef.current?.focus();
  }

  function updateQty(variantId: string, qty: number) {
    setBasket((prev) => (qty <= 0 ? prev.filter((b) => b.variantId !== variantId) : prev.map((b) => (b.variantId === variantId ? { ...b, quantity: qty } : b))));
  }

  function voidBasket() {
    if (basket.length === 0) return;
    if (!confirm("Void this basket? All items will be removed.")) return;
    setBasket([]);
    setCustomer(null);
    setRedeemPoints("");
    setDiscountTotal("0");
  }

  function holdSale() {
    if (basket.length === 0) return;
    const label = customer ? `${customer.firstName ?? "Customer"}` : `Sale ${heldSales.length + 1}`;
    setHeldSales((prev) => [...prev, { id: crypto.randomUUID(), label, items: basket, customer, discountTotal }]);
    setBasket([]);
    setCustomer(null);
    setRedeemPoints("");
    setDiscountTotal("0");
  }

  function resumeSale(id: string) {
    if (basket.length > 0) {
      if (!confirm("Your current basket is not empty. Resuming will replace it. Continue?")) return;
    }
    const held = heldSales.find((h) => h.id === id);
    if (!held) return;
    setBasket(held.items);
    setCustomer(held.customer);
    setDiscountTotal(held.discountTotal);
    setHeldSales((prev) => prev.filter((h) => h.id !== id));
  }

  function discardHeld(id: string) {
    setHeldSales((prev) => prev.filter((h) => h.id !== id));
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    const created = await api.post<Customer>("/api/pos/customers", newCustomer);
    setCustomer(created);
    setShowNewCustomer(false);
    setShowCustomerSearch(false);
    setPhoneQuery("");
    setCustomerResults([]);
    setNewCustomer({ firstName: "", lastName: "", phone: "" });
  }

  const subtotal = basket.reduce((sum, b) => sum + b.price * b.quantity, 0);
  const taxTotal = basket.reduce((sum, b) => sum + (b.price * b.quantity * b.taxRate) / 100, 0);
  const discount = Number(discountTotal) || 0;

  const rule = loyaltyRule;
  const maxByOrderCap = rule ? Math.floor(((subtotal - discount) * rule.maxRedeemPercent) / 100 / rule.redeemPointValue) : 0;
  const maxRedeemable = rule ? Math.max(0, Math.min(customer?.loyaltyPoints ?? 0, maxByOrderCap)) : 0;
  const redeemVal = Math.min(Number(redeemPoints) || 0, maxRedeemable);
  const loyaltyDiscountEstimate = rule && redeemVal >= rule.minRedeemPoints ? redeemVal * rule.redeemPointValue : 0;

  const total = Math.max(0, subtotal - discount + taxTotal - loyaltyDiscountEstimate);
  const change = tendered ? Math.max(0, Number(tendered) - total) : 0;

  function printEstimate() {
    if (basket.length === 0) return;
    setReceiptData({
      mode: "estimate",
      storeName: settings.branding?.siteName ?? "Store",
      storeAddress: settings.contact?.address,
      storePhone: settings.contact?.phone,
      dateTime: new Date().toLocaleString(),
      items: basket.map((b) => ({ name: b.productName, variantName: b.variantName, sku: b.sku, quantity: b.quantity, unitPrice: b.price, total: b.price * b.quantity })),
      subtotal,
      discountTotal: discount,
      taxTotal,
      total,
    });
  }

  function openFinalBillDialog() {
    if (basket.length === 0 || !session) return;
    setBillTo({ name: customer ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() : "", phone: customer?.phone ?? "" });
    setShowFinalBill(true);
  }

  async function completeSale() {
    if (!session) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await api.post<any>("/api/pos/sale", {
        locationId: session.locationId,
        items: basket.map((b) => ({ variantId: b.variantId, quantity: b.quantity })),
        customerId: customer?.id,
        customerName: billTo.name || "Walk-in Customer",
        customerPhone: billTo.phone || undefined,
        paymentMethod,
        amountTendered: tendered ? Number(tendered) : undefined,
        discountTotal: discount,
        redeemPoints: rule && redeemVal >= rule.minRedeemPoints ? redeemVal : undefined,
      });

      setShowFinalBill(false);
      setReceiptData({
        mode: "final",
        storeName: settings.branding?.siteName ?? "Store",
        storeAddress: settings.contact?.address,
        storePhone: settings.contact?.phone,
        orderNumber: res.order.orderNumber,
        dateTime: new Date().toLocaleString(),
        billTo,
        items: res.order.items.map((i: any) => ({ name: i.name, variantName: i.variantName, sku: i.sku, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
        subtotal: Number(res.order.subtotal),
        discountTotal: Number(res.order.discountTotal),
        taxTotal: Number(res.order.taxTotal),
        total: Number(res.order.total),
        paymentMethod,
        amountTendered: tendered ? Number(tendered) : undefined,
        change: res.change,
        loyaltyPointsEarned: res.order.loyaltyPointsEarnedNow ?? undefined,
        customerLoyaltyBalance: customer ? customer.loyaltyPoints + (res.order.loyaltyPointsEarnedNow ?? 0) - redeemVal : undefined,
      });

      setBasket([]);
      setCustomer(null);
      setRedeemPoints("");
      setDiscountTotal("0");
      setTendered("");
      setMobileView("menu");
    } catch (err: any) {
      setError(err.message ?? "Sale failed");
      setShowFinalBill(false);
    } finally {
      setProcessing(false);
    }
  }

  async function openCloseSessionPanel() {
    if (!session) return;
    const summary = await api.get(`/api/pos/sessions/${session.id}/summary`);
    setSessionSummary(summary);
    setClosingBalance("");
    setCloseResult(null);
    setShowCloseSession(true);
  }

  async function submitCloseSession() {
    if (!session) return;
    const result = await api.put(`/api/pos/sessions/${session.id}/close`, { closingBalance: Number(closingBalance) });
    setCloseResult(result);
  }

  function finishCloseSession() {
    setShowCloseSession(false);
    setSession(null);
  }

  // ---- No open session ----
  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--pos-line)] bg-[var(--pos-card)] p-6">
          <Link href="/" className="mb-4 inline-flex items-center gap-1 text-xs text-[var(--pos-text-40)] hover:text-[var(--pos-text-70)]">
            <ArrowLeft size={12} /> Back to Admin
          </Link>
          <h1 className="text-xl font-bold">Open POS Session</h1>
          <form onSubmit={openSession} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--pos-text-50)]">Store Location</label>
              <select
                required
                className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] px-3 py-2.5 text-sm"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="">Select location</option>
                {locations.filter((l) => l.type === "STORE").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--pos-text-50)]">Opening Cash Balance</label>
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] px-3 py-2.5 text-sm"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <button type="submit" className="min-h-[48px] w-full rounded-lg bg-[var(--pos-green)] font-bold text-black transition hover:bg-[var(--pos-green-hover)]">
              Start Session
            </button>
          </form>
        </div>
      </div>
    );
  }

  const elapsedMin = Math.max(0, Math.floor((now - new Date(session.openedAt).getTime()) / 60000));
  const itemCount = basket.reduce((s, b) => s + b.quantity, 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Receipt80mm data={receiptData} />

      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--pos-line)] bg-[var(--pos-card)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[var(--pos-text-40)] hover:bg-[var(--pos-surface)]" title="Back to Admin">
            <LayoutDashboard size={17} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.location?.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-[var(--pos-text-40)]">
              <Clock size={11} /> Opened {formatNpr(session.openingBalance)} · {elapsedMin < 60 ? `${elapsedMin}m ago` : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m ago`}
            </p>
          </div>
        </div>
        <button onClick={openCloseSessionPanel} className="min-h-[36px] flex-shrink-0 rounded-md bg-[var(--pos-surface)] px-3 text-xs font-semibold text-[var(--pos-text-70)] hover:bg-[var(--pos-surface-hover)]">
          Close Session
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---- Menu (left) ---- */}
        <div className={`${mobileView === "menu" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
          <div className="space-y-2 border-b border-[var(--pos-line)] px-4 py-3">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pos-text-40)]" />
                <input
                  ref={barcodeRef}
                  className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] py-2.5 pl-9 pr-3 text-sm"
                  placeholder="Scan barcode / exact SKU…"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                />
              </div>
              <button type="submit" className="min-h-[40px] rounded-lg bg-[var(--pos-surface-strong)] px-4 text-sm font-semibold hover:bg-[var(--pos-surface-hover)]">
                Add
              </button>
            </form>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pos-text-40)]" />
              <input
                className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] py-2.5 pl-9 pr-3 text-sm"
                placeholder="Search by name, shade, size…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {error && <p className="rounded-lg bg-[var(--pos-red)]/10 px-3 py-2 text-xs text-[var(--pos-red)]">{error}</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <PosProductGrid variants={results} onSelect={addVariantToBasket} />
          </div>

          {/* Mobile: floating view-cart bar */}
          {itemCount > 0 && (
            <button
              onClick={() => setMobileView("cart")}
              className="m-3 flex min-h-[52px] items-center justify-between rounded-xl bg-[var(--pos-green)] px-4 font-bold text-black lg:hidden"
            >
              <span>View Cart · {itemCount} item{itemCount !== 1 ? "s" : ""}</span>
              <span>{formatNpr(total)}</span>
            </button>
          )}
        </div>

        {/* ---- Cart (right aside) ---- */}
        <aside className={`${mobileView === "cart" ? "flex" : "hidden"} min-h-0 w-full shrink-0 flex-col border-t border-[var(--pos-line)] bg-[var(--pos-card)] lg:flex lg:w-[400px] lg:border-l lg:border-t-0`}>
          <div className="border-b border-[var(--pos-line)] px-4 py-3">
            <button onClick={() => setMobileView("menu")} className="mb-2 flex min-h-[36px] touch-manipulation items-center gap-1 rounded-md bg-[var(--pos-surface)] px-2.5 text-xs font-semibold text-[var(--pos-text-70)] active:scale-95 lg:hidden">
              <ArrowLeft size={12} /> Back to menu
            </button>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--pos-text-40)]">Active Cart · #{session.id.slice(-5).toUpperCase()}</div>
                <div className="font-bold">{session.location?.name}</div>
              </div>
            </div>

            {customer ? (
              <div className="mt-2 flex items-center justify-between rounded-md bg-[var(--pos-brand)]/15 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{customer.firstName} {customer.lastName}</p>
                  <p className="text-[10px] text-[var(--pos-text-50)]">{customer.phone} · {customer.loyaltyPoints} pts</p>
                </div>
                <button onClick={() => setCustomer(null)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-[var(--pos-text-40)] hover:text-[var(--pos-red)]"><X size={14} /></button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-[11px] text-[var(--pos-text-30)]">No customer attached</span>
                <button onClick={() => setShowCustomerSearch((v) => !v)} className="flex min-h-[28px] items-center gap-1 rounded-md bg-[var(--pos-surface)] px-2 py-1 text-[11px] text-[var(--pos-text-70)] hover:bg-[var(--pos-surface-hover)]">
                  <UserPlus size={11} /> Customer
                </button>
              </div>
            )}

            {showCustomerSearch && !customer && (
              <div className="relative mt-2">
                <input
                  className="w-full rounded-md border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2.5 py-2 text-xs"
                  placeholder="Search by phone…"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                />
                {customerResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-[var(--pos-line)] bg-[var(--pos-surface-strong)] shadow-xl">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setCustomer(c); setShowCustomerSearch(false); setPhoneQuery(""); setCustomerResults([]); }}
                        className="flex w-full items-center justify-between border-b border-[var(--pos-line)] px-2.5 py-2 text-left text-xs last:border-0 hover:bg-[var(--pos-surface-hover)]"
                      >
                        <span>{c.firstName} {c.lastName} — {c.phone}</span>
                        <span className="text-[var(--pos-text-40)]">{c.loyaltyPoints} pts</span>
                      </button>
                    ))}
                  </div>
                )}
                {!showNewCustomer ? (
                  <button onClick={() => setShowNewCustomer(true)} className="mt-1.5 text-[11px] text-[var(--pos-brand)] underline">
                    + New customer
                  </button>
                ) : (
                  <form onSubmit={createCustomer} className="mt-2 grid grid-cols-2 gap-1.5 rounded-md border border-[var(--pos-line)] p-2">
                    <input required placeholder="First name" className="rounded border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2 py-1.5 text-xs" value={newCustomer.firstName} onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })} />
                    <input placeholder="Last name" className="rounded border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2 py-1.5 text-xs" value={newCustomer.lastName} onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })} />
                    <input required placeholder="Phone" className="col-span-2 rounded border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2 py-1.5 text-xs" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                    <button type="submit" className="col-span-2 rounded bg-[var(--pos-green)] py-1.5 text-xs font-bold text-black">Save Customer</button>
                  </form>
                )}
              </div>
            )}

            {customer && rule && customer.loyaltyPoints >= rule.minRedeemPoints && (
              <div className="mt-2">
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--pos-text-40)]">Redeem points (min {rule.minRedeemPoints}, max {maxRedeemable})</label>
                <input type="number" className="w-full rounded-md border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2.5 py-1.5 text-xs" placeholder="0" value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} />
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={holdSale} disabled={basket.length === 0} className="flex min-h-[32px] items-center justify-center gap-1 rounded-md bg-[var(--pos-surface)] text-[11px] text-[var(--pos-text-70)] hover:bg-[var(--pos-surface-hover)] disabled:opacity-30">
                <PauseCircle size={12} /> Hold Sale
              </button>
              <button
                onClick={() => heldSales.length === 1 && resumeSale(heldSales[0]!.id)}
                disabled={heldSales.length === 0}
                className="flex min-h-[32px] items-center justify-center gap-1 rounded-md bg-[var(--pos-surface)] text-[11px] text-[var(--pos-text-70)] hover:bg-[var(--pos-surface-hover)] disabled:opacity-30"
              >
                <PlayCircle size={12} /> Held ({heldSales.length})
              </button>
            </div>

            {heldSales.length > 1 && (
              <div className="mt-2 space-y-1.5">
                {heldSales.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md bg-[var(--pos-surface)] px-2 py-1.5 text-[11px]">
                    <span className="truncate">{h.label} · {h.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                    <div className="flex flex-shrink-0 gap-2">
                      <button onClick={() => resumeSale(h.id)} className="text-[var(--pos-green)]">Resume</button>
                      <button onClick={() => discardHeld(h.id)} className="text-[var(--pos-red)]">Discard</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {basket.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-[var(--pos-text-30)]">Basket is empty. Scan or tap a product.</p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[var(--pos-line)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--pos-text-30)]">
                  <span>Item</span><span className="text-right">Unit</span><span className="text-right">Total</span>
                </div>
                {basket.map((b) => (
                  <div key={b.variantId} className="border-b border-[var(--pos-line)] px-4 py-2.5">
                    <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2 text-sm">
                      <span className="font-medium">{b.productName}{b.variantName ? <span className="text-[var(--pos-text-50)]"> ({b.variantName})</span> : ""}</span>
                      <span className="text-right text-[var(--pos-text-60)]">{formatNpr(b.price)}</span>
                      <span className="text-right font-semibold">{formatNpr(b.price * b.quantity)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-md bg-[var(--pos-surface)]">
                        <button onClick={() => updateQty(b.variantId, b.quantity - 1)} className="flex h-8 w-8 items-center justify-center text-[var(--pos-text-70)]"><Minus size={13} /></button>
                        <span className="w-6 text-center text-sm font-semibold">{b.quantity}</span>
                        <button onClick={() => updateQty(b.variantId, b.quantity + 1)} className="flex h-8 w-8 items-center justify-center text-[var(--pos-text-70)]"><Plus size={13} /></button>
                      </div>
                      <button
                        onClick={() => updateQty(b.variantId, 0)}
                        className="ml-auto min-h-[36px] touch-manipulation rounded-lg bg-[var(--pos-red)]/15 px-3 text-xs font-medium text-[var(--pos-red)] transition hover:bg-[var(--pos-red)]/25 active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Totals + actions */}
          <div className="border-t border-[var(--pos-line)] px-4 py-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[var(--pos-text-50)]"><span>Sub-Total ({itemCount} items)</span><span>{formatNpr(subtotal)}</span></div>
              <div className="flex items-center justify-between text-[var(--pos-text-50)]">
                {editingDiscount ? (
                  <>
                    <span>Discount</span>
                    <input
                      autoFocus
                      type="number"
                      className="w-24 rounded border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2 py-0.5 text-right text-xs"
                      value={discountTotal}
                      onChange={(e) => setDiscountTotal(e.target.value)}
                      onBlur={() => setEditingDiscount(false)}
                    />
                  </>
                ) : (
                  <button onClick={() => setEditingDiscount(true)} className="flex w-full items-center justify-between hover:text-[var(--pos-text-70)]">
                    <span className="flex items-center gap-1">Discount <span className="rounded bg-[var(--pos-surface-strong)] px-1.5 text-[10px] text-[var(--pos-text-70)]">Edit</span></span>
                    <span>{formatNpr(discount)}</span>
                  </button>
                )}
              </div>
              {loyaltyDiscountEstimate > 0 && (
                <div className="flex justify-between text-[var(--pos-text-50)]"><span>Loyalty Points</span><span>-{formatNpr(loyaltyDiscountEstimate)}</span></div>
              )}
              <div className="flex justify-between text-[var(--pos-text-50)]"><span>VAT</span><span>{formatNpr(taxTotal)}</span></div>
              <div className="flex justify-between border-t border-[var(--pos-line)] pt-1.5 text-lg font-bold text-[var(--pos-green)]"><span>TOTAL DUE</span><span>{formatNpr(total)}</span></div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {["CASH", "CARD_POS", "FONEPAY", "ESEWA"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`min-h-[36px] rounded-md text-[11px] font-semibold ${paymentMethod === m ? "bg-[var(--pos-brand)] text-white" : "bg-[var(--pos-surface)] text-[var(--pos-text-60)]"}`}
                >
                  {m.replace("_", " ")}
                </button>
              ))}
            </div>
            {paymentMethod === "CASH" && (
              <div className="mt-2 flex items-center gap-2">
                <input type="number" className="flex-1 rounded-md border border-[var(--pos-line)] bg-[var(--pos-surface)] px-2.5 py-1.5 text-xs" placeholder="Amount tendered" value={tendered} onChange={(e) => setTendered(e.target.value)} />
                {tendered && <span className="whitespace-nowrap text-xs text-[var(--pos-text-50)]">Change {formatNpr(change)}</span>}
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={voidBasket} disabled={basket.length === 0} className="rounded-lg bg-[var(--pos-surface-strong)] py-2 text-xs font-semibold text-[var(--pos-text-80)] hover:bg-[var(--pos-surface-hover)] disabled:opacity-40">
                Void Basket
              </button>
              <button onClick={printEstimate} disabled={basket.length === 0} className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--pos-surface-strong)] py-2 text-xs font-semibold text-[var(--pos-text-80)] hover:bg-[var(--pos-surface-hover)] disabled:opacity-40">
                <Printer size={13} /> Estimate
              </button>
              <button onClick={openFinalBillDialog} disabled={basket.length === 0 || processing} className="rounded-lg bg-[var(--pos-green)] py-2 text-xs font-bold text-black hover:bg-[var(--pos-green-hover)] disabled:opacity-40">
                Proceed to Pay
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Final Bill Information dialog */}
      {showFinalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--pos-line)] bg-[var(--pos-card)] p-5">
            <h2 className="text-lg font-bold">Final Bill Information</h2>
            <p className="mt-1 text-xs text-[var(--pos-text-40)]">This appears in the receipt header. Defaults to the selected customer.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--pos-text-50)]">Bill To (Name)</label>
                <input className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] px-3 py-2 text-sm" value={billTo.name} onChange={(e) => setBillTo({ ...billTo, name: e.target.value })} placeholder="Walk-in Customer" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--pos-text-50)]">Phone</label>
                <input className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] px-3 py-2 text-sm" value={billTo.phone} onChange={(e) => setBillTo({ ...billTo, phone: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 space-y-1 rounded-lg bg-[var(--pos-surface)] p-3 text-sm">
              <div className="flex justify-between"><span className="text-[var(--pos-text-50)]">Total</span><span className="font-bold text-[var(--pos-green)]">{formatNpr(total)}</span></div>
              <div className="flex justify-between text-[var(--pos-text-50)]"><span>Payment</span><span>{paymentMethod.replace("_", " ")}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowFinalBill(false)} className="min-h-[44px] flex-1 rounded-lg bg-[var(--pos-surface)] text-sm font-semibold text-[var(--pos-text-80)]">Cancel</button>
              <button onClick={completeSale} disabled={processing} className="min-h-[44px] flex-1 rounded-lg bg-[var(--pos-green)] text-sm font-bold text-black">{processing ? "Processing…" : "Confirm & Print"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Close session panel */}
      {showCloseSession && sessionSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--pos-line)] bg-[var(--pos-card)] p-5">
            <h2 className="text-lg font-bold">Close Session</h2>
            {!closeResult ? (
              <>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-[var(--pos-text-50)]"><span>Opening Balance</span><span>{formatNpr(sessionSummary.session.openingBalance)}</span></div>
                  <div className="flex justify-between text-[var(--pos-text-50)]"><span>Cash Sales</span><span>{formatNpr(sessionSummary.cashSalesTotal)}</span></div>
                  <div className="flex justify-between font-bold"><span>Expected Cash</span><span>{formatNpr(sessionSummary.expectedCashBalance)}</span></div>
                </div>
                <div className="mt-3 rounded-lg bg-[var(--pos-surface)] p-3">
                  <p className="mb-1 text-xs font-semibold text-[var(--pos-text-40)]">Sales by Method</p>
                  {Object.entries(sessionSummary.byMethod).map(([method, info]: [string, any]) => (
                    <div key={method} className="flex justify-between text-sm"><span>{method}</span><span>{info.count} · {formatNpr(info.total)}</span></div>
                  ))}
                  {Object.keys(sessionSummary.byMethod).length === 0 && <p className="text-sm text-[var(--pos-text-30)]">No sales this session</p>}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs text-[var(--pos-text-50)]">Counted Cash in Drawer</label>
                  <input type="number" autoFocus className="w-full rounded-lg border border-[var(--pos-line)] bg-[var(--pos-surface)] px-3 py-2 text-sm" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setShowCloseSession(false)} className="min-h-[44px] flex-1 rounded-lg bg-[var(--pos-surface)] text-sm font-semibold text-[var(--pos-text-80)]">Cancel</button>
                  <button onClick={submitCloseSession} disabled={!closingBalance} className="min-h-[44px] flex-1 rounded-lg bg-[var(--pos-green)] text-sm font-bold text-black disabled:opacity-40">Close Session</button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-[var(--pos-text-50)]"><span>Expected</span><span>{formatNpr(closeResult.expectedBalance)}</span></div>
                  <div className="flex justify-between text-[var(--pos-text-50)]"><span>Counted</span><span>{formatNpr(closeResult.closingBalance)}</span></div>
                  <div className={`flex justify-between text-base font-bold ${closeResult.variance === 0 ? "text-[var(--pos-green)]" : closeResult.variance > 0 ? "text-blue-400" : "text-[var(--pos-red)]"}`}>
                    <span>Variance</span><span>{closeResult.variance > 0 ? "+" : ""}{formatNpr(closeResult.variance)}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--pos-text-40)]">
                  {closeResult.variance === 0 ? "Drawer balances exactly." : closeResult.variance > 0 ? "Drawer has more cash than expected." : "Drawer is short of the expected amount."}
                </p>
                <button onClick={finishCloseSession} className="mt-5 min-h-[44px] w-full rounded-lg bg-[var(--pos-green)] text-sm font-bold text-black">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
