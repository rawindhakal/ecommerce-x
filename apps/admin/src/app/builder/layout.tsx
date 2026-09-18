"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * The page builder runs full-screen, deliberately outside the (dashboard)
 * shell (same reasoning as the POS layout) — the canvas/palette/settings
 * three-pane layout needs the whole viewport, not the admin sidebar chrome.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized, fetchMe } = useAuthStore();

  useEffect(() => {
    if (!initialized) fetchMe();
  }, [initialized, fetchMe]);

  useEffect(() => {
    if (initialized && !user) router.push("/login");
  }, [initialized, user, router]);

  if (!initialized || !user) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-400">Loading…</div>;
  }

  return <>{children}</>;
}
