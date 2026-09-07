import Link from "next/link";
import { XCircle } from "lucide-react";

export default async function CheckoutFailedPage(props: { searchParams: Promise<{ orderId?: string; reason?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="container-x flex flex-col items-center py-20 text-center">
      <XCircle size={56} className="text-red-500" />
      <h1 className="mt-4 font-display text-3xl">Payment Failed</h1>
      <p className="mt-2 max-w-md text-ink/60">
        {searchParams.reason || "We couldn't confirm your payment. Your order is still saved and no stock was deducted."}
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/checkout" className="btn-primary">Try Again</Link>
        <Link href="/" className="btn-outline">Back to Home</Link>
      </div>
    </div>
  );
}
