"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface LoyaltyData {
  balance: number;
  transactions: { id: string; type: string; points: number; note: string | null; createdAt: string }[];
}

export default function LoyaltyPage() {
  const [data, setData] = useState<LoyaltyData | null>(null);

  useEffect(() => {
    api.get<LoyaltyData>("/api/loyalty/me").then(setData);
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl">Loyalty Points</h1>
      <div className="card mt-4 p-6">
        <p className="text-sm text-ink/50">Current Balance</p>
        <p className="mt-1 text-4xl font-semibold text-brand">{data?.balance ?? 0} pts</p>
        <p className="mt-2 text-xs text-ink/40">Earn points on every purchase. Redeem them at checkout for a discount.</p>
      </div>

      <div className="card mt-6 divide-y divide-ink/10">
        {data?.transactions.length === 0 && <p className="p-5 text-sm text-ink/50">No activity yet.</p>}
        {data?.transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{t.type}</p>
              {t.note && <p className="text-ink/50">{t.note}</p>}
              <p className="text-xs text-ink/40">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={t.points > 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>
              {t.points > 0 ? "+" : ""}{t.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
