"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export default function FonepayQrPage({ params }: { params: { paymentId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState("PENDING");
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await api.get<{ status: string }>(`/api/payments/${params.paymentId}/status`);
      setStatus(res.status);
      if (res.status === "PAID") {
        clearInterval(interval);
        router.push(`/checkout/success?orderId=${orderId}`);
      }
      if (res.status === "FAILED") {
        clearInterval(interval);
        router.push(`/checkout/failed?orderId=${orderId}`);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [params.paymentId, orderId, router]);

  return (
    <div className="container-x flex flex-col items-center py-20 text-center">
      <h1 className="font-display text-2xl">Scan to Pay with Fonepay</h1>
      <p className="mt-2 text-sm text-ink/60">Open your mobile banking or wallet app and scan the QR code below.</p>
      <div className="mt-8 flex h-64 w-64 items-center justify-center rounded-2xl border border-ink/10 bg-white">
        <span className="text-sm text-ink/40">QR code image renders here from the Fonepay response</span>
      </div>
      <p className="mt-4 text-xs uppercase tracking-wide text-ink/40">Status: {status}</p>

      {isDev && (
        <div className="mt-8 rounded-lg border border-dashed border-ink/20 p-4">
          <p className="mb-2 text-xs text-ink/50">Dev tools (hidden in production)</p>
          <button
            className="btn-outline"
            onClick={async () => {
              await api.post(`/api/payments/${params.paymentId}/dev-complete`, { outcome: "success" });
              router.push(`/checkout/success?orderId=${orderId}`);
            }}
          >
            Simulate Successful Payment
          </button>
        </div>
      )}
    </div>
  );
}
