"use client";

import { formatNpr } from "@/lib/format";

export interface ReceiptLineItem {
  name: string;
  variantName?: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  mode: "estimate" | "final";
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  orderNumber?: string;
  dateTime: string;
  cashierName?: string;
  billTo?: { name?: string; phone?: string };
  items: ReceiptLineItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal?: number;
  total: number;
  paymentMethod?: string;
  amountTendered?: number;
  change?: number;
  loyaltyPointsEarned?: number;
  customerLoyaltyBalance?: number;
}

/**
 * Always mounted, positioned off-screen — global print CSS (globals.css)
 * hides everything else and shows only #pos-receipt at true 80mm width when
 * the browser print dialog opens, so this never has to be a popup window.
 */
export function Receipt80mm({ data }: { data: ReceiptData | null }) {
  if (!data) return <div id="pos-receipt" />;

  return (
    <div id="pos-receipt" className="fixed left-[-9999px] top-0 w-[80mm] bg-white p-2 font-mono text-[11px] leading-tight text-black">
      {data.mode === "estimate" && (
        <p className="mb-1 text-center text-xs font-bold">*** ESTIMATE — NOT A VALID RECEIPT ***</p>
      )}
      <div className="text-center">
        <p className="text-sm font-bold">{data.storeName}</p>
        {data.storeAddress && <p>{data.storeAddress}</p>}
        {data.storePhone && <p>{data.storePhone}</p>}
      </div>

      <div className="my-1.5 border-t border-dashed border-black" />

      {data.mode === "final" && data.orderNumber && <p>Order: {data.orderNumber}</p>}
      <p>Date: {data.dateTime}</p>
      {data.cashierName && <p>Cashier: {data.cashierName}</p>}
      {data.billTo?.name && <p>Bill To: {data.billTo.name}</p>}
      {data.billTo?.phone && <p>Phone: {data.billTo.phone}</p>}

      <div className="my-1.5 border-t border-dashed border-black" />

      {data.items.map((item, i) => (
        <div key={i} className="mb-1">
          <p className="font-semibold">{item.name}{item.variantName ? ` (${item.variantName})` : ""}</p>
          <div className="flex justify-between">
            <span>{item.quantity} x {formatNpr(item.unitPrice)}</span>
            <span>{formatNpr(item.total)}</span>
          </div>
        </div>
      ))}

      <div className="my-1.5 border-t border-dashed border-black" />

      <div className="flex justify-between"><span>Subtotal</span><span>{formatNpr(data.subtotal)}</span></div>
      {data.discountTotal > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatNpr(data.discountTotal)}</span></div>}
      {!!data.taxTotal && <div className="flex justify-between"><span>Tax</span><span>{formatNpr(data.taxTotal)}</span></div>}
      <div className="mt-1 flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatNpr(data.total)}</span></div>

      {data.mode === "final" && (
        <>
          <div className="my-1.5 border-t border-dashed border-black" />
          {data.paymentMethod && <div className="flex justify-between"><span>Paid via</span><span>{data.paymentMethod}</span></div>}
          {typeof data.amountTendered === "number" && <div className="flex justify-between"><span>Tendered</span><span>{formatNpr(data.amountTendered)}</span></div>}
          {typeof data.change === "number" && <div className="flex justify-between"><span>Change</span><span>{formatNpr(data.change)}</span></div>}
          {!!data.loyaltyPointsEarned && (
            <div className="mt-1 flex justify-between">
              <span>Points Earned</span>
              <span>+{data.loyaltyPointsEarned}{typeof data.customerLoyaltyBalance === "number" ? ` (bal: ${data.customerLoyaltyBalance})` : ""}</span>
            </div>
          )}
        </>
      )}

      <div className="my-1.5 border-t border-dashed border-black" />
      <p className="text-center">{data.mode === "estimate" ? "Prices subject to change." : "Thank you for shopping with us!"}</p>
    </div>
  );
}
