import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { formatNpr } from "@/lib/format";
import { PurchaseTracker } from "./purchase-tracker";

interface OrderDetail {
  id: string;
  orderNumber: string;
  total: string;
  status: string;
  paymentStatus: string;
  items: { name: string; quantity: number; total: string }[];
}

export default async function CheckoutSuccessPage(props: { searchParams: Promise<{ orderId?: string }> }) {
  const searchParams = await props.searchParams;
  const order = searchParams.orderId ? await serverGet<OrderDetail>(`/api/orders/${searchParams.orderId}`, 0) : null;

  return (
    <div className="container-x flex flex-col items-center py-20 text-center">
      {order && <PurchaseTracker orderId={order.id} orderNumber={order.orderNumber} total={Number(order.total)} />}
      <CheckCircle2 size={56} className="text-green-500" />
      <h1 className="mt-4 font-display text-3xl">Thank you for your order!</h1>
      {order ? (
        <>
          <p className="mt-2 text-ink/60">Order #{order.orderNumber} has been placed successfully.</p>
          <div className="card mt-8 w-full max-w-md p-6 text-left">
            <ul className="space-y-2 text-sm">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{formatNpr(item.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 font-semibold">
              <span>Total</span>
              <span>{formatNpr(order.total)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-ink/60">We could not find that order.</p>
      )}
      <div className="mt-8 flex gap-3">
        <Link href="/account/orders" className="btn-outline">View Orders</Link>
        <Link href="/products" className="btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
