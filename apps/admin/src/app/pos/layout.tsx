"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * The POS terminal runs full-screen with its own dark theme — deliberately
 * outside the (dashboard) shell so cashiers get a focused, professional
 * point-of-sale surface instead of the general admin chrome.
 */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized, fetchMe } = useAuthStore();

  useEffect(() => {
    if (!initialized) fetchMe();
  }, [initialized, fetchMe]);

  useEffect(() => {
    if (initialized && !user) router.push("/login");
  }, [initialized, user, router]);

  if (!initialized || !user) {
    return <div className="pos-theme flex min-h-dvh items-center justify-center text-[var(--pos-text-40)]">Loading…</div>;
  }

  return <div className="pos-theme">{children}</div>;
}
