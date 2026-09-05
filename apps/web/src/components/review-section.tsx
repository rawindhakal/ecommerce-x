"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null };
}

export function ReviewSection({ productId, initialReviews, avgRating, reviewCount }: { productId: string; initialReviews: Review[]; avgRating: string; reviewCount: number }) {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState(initialReviews);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post("/api/reviews", { productId, rating, comment });
      setMessage("Thanks! Your review will appear once approved.");
      setComment("");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-16">
      <h2 className="font-display text-2xl">Reviews</h2>
      <div className="mt-2 flex items-center gap-2 text-sm text-ink/60">
        <Star size={16} className="fill-amber-400 text-amber-400" />
        {Number(avgRating).toFixed(1)} out of 5 ({reviewCount} reviews)
      </div>

      <div className="mt-6 space-y-6">
        {reviews.length === 0 && <p className="text-sm text-ink/50">No reviews yet. Be the first to review this product.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="border-b border-ink/10 pb-5">
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-ink/20"} />
              ))}
              {r.verifiedPurchase && <span className="text-[11px] font-medium text-green-600">Verified Purchase</span>}
            </div>
            {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
            {r.comment && <p className="mt-1 text-sm text-ink/70">{r.comment}</p>}
            <p className="mt-1 text-xs text-ink/40">
              {r.user.firstName} {r.user.lastName?.charAt(0) ?? ""}. — {new Date(r.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {user ? (
        <form onSubmit={submitReview} className="mt-8 max-w-md space-y-3">
          <h3 className="text-sm font-semibold">Write a review</h3>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button type="button" key={i} onClick={() => setRating(i + 1)}>
                <Star size={20} className={i < rating ? "fill-amber-400 text-amber-400" : "text-ink/20"} />
              </button>
            ))}
          </div>
          <textarea className="input" rows={3} placeholder="Share your thoughts…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
          {message && <p className="text-sm text-ink/60">{message}</p>}
        </form>
      ) : (
        <p className="mt-6 text-sm text-ink/50">Sign in to write a review.</p>
      )}
    </div>
  );
}
