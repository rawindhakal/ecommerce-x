"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Wraps the /products filter sections so they render as the normal static
 * sidebar on desktop and as a slide-over drawer (triggered by a "Filters"
 * button) on mobile — the same filter components are mounted in both
 * places, each independently reflecting the URL, only one visible at a
 * time per breakpoint.
 */
export function MobileFilterDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline lg:hidden">
        <SlidersHorizontal size={15} /> Filters
      </button>

      <aside className="hidden space-y-6 lg:block">{children}</aside>

      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-white p-5 shadow-xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg">Filters</h2>
            <button onClick={() => setOpen(false)} aria-label="Close filters"><X size={20} /></button>
          </div>
          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </>
  );
}
