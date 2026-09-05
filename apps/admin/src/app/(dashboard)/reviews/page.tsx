"use client";

import { useEffect, useState } from "react";
import { Check, X, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: string;
  verifiedPurchase: boolean;
  product: { name: string };
  user: { firstName: string | null; lastName: string | null; email: string | null };
  createdAt: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState("PENDING");

  async function load() {
    const res = await api.get<PaginatedResult<Review>>(`/api/reviews/admin?status=${status}&pageSize=50`);
    setReviews(res.items);
  }
  useEffect(() => { load(); }, [status]);

  async function setReviewStatus(id: string, s: string) {
    await api.put(`/api/reviews/${id}/status`, { status: s });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    await api.delete(`/api/reviews/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reviews</h1>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="space-y-3">
        {reviews.length === 0 && <p className="text-sm text-slate-400">No reviews in this status.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="card flex items-start justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                <span className="text-sm font-medium">{r.product.name}</span>
                {r.verifiedPurchase && <span className="badge bg-green-50 text-green-700">Verified</span>}
              </div>
              {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
              {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
              <p className="mt-1 text-xs text-slate-400">{r.user.firstName} {r.user.lastName} — {new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              {status === "PENDING" && (
                <>
                  <button onClick={() => setReviewStatus(r.id, "APPROVED")} className="rounded-lg bg-green-50 p-2 text-green-600 hover:bg-green-100"><Check size={15} /></button>
                  <button onClick={() => setReviewStatus(r.id, "REJECTED")} className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"><X size={15} /></button>
                </>
              )}
              <button onClick={() => remove(r.id)} className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
