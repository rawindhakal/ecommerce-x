"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Search, Heart, User, ShoppingBag, Menu, X, ChevronDown } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import type { PublicSettings } from "@/lib/settings";

interface CategoryLink {
  id: string;
  name: string;
  slug: string;
  children?: CategoryLink[];
}

export function Header({ settings, categories }: { settings: PublicSettings; categories: CategoryLink[] }) {
  const { cart, fetchCart, setOpen } = useCartStore();
  const { user, fetchMe, initialized } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
    if (!initialized) fetchMe();
  }, [fetchCart, fetchMe, initialized]);

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/95 backdrop-blur">
      <div className="border-b border-ink/5 bg-ink py-1.5 text-center text-xs text-white">
        Free delivery in Kathmandu Valley on orders above Rs. 3,000
      </div>
      <div className="container-x flex items-center gap-4 py-3 sm:gap-6 sm:py-4">
        <button
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link href="/" className="flex min-w-0 items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {settings.branding.logoUrl ? (
            <Image
              src={
                settings.branding.logoUrl.startsWith("http")
                  ? settings.branding.logoUrl
                  : `${process.env.NEXT_PUBLIC_API_URL}${settings.branding.logoUrl}`
              }
              alt={settings.branding.siteName ?? "Logo"}
              width={36}
              height={36}
              unoptimized
              className="h-8 w-8 flex-shrink-0 rounded-full object-cover sm:h-9 sm:w-9"
            />
          ) : null}
          <span className="truncate">{settings.branding.siteName}</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-7 text-sm font-medium text-ink/80 lg:flex">
          {categories.map((cat) => (
            <div key={cat.id} className="group relative">
              <Link href={`/categories/${cat.slug}`} className="flex items-center gap-1 py-2 transition hover:text-brand">
                {cat.name}
              </Link>
              {!!cat.children?.length && (
                <div className="invisible absolute left-0 top-full flex gap-8 rounded-xl border border-ink/5 bg-white p-5 opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100">
                  {cat.children.map((child) => (
                    <Link key={child.id} href={`/categories/${child.slug}`} className="block whitespace-nowrap text-sm text-ink/70 hover:text-brand">
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/products?featured=true" className="py-2 transition hover:text-brand">
            Featured
          </Link>
        </nav>

        <form action="/search" className="hidden max-w-xs flex-1 items-center rounded-full border border-ink/10 px-4 py-2 md:flex">
          <Search size={16} className="text-ink/40" />
          <input name="q" placeholder="Search products…" className="ml-2 w-full bg-transparent text-sm outline-none" />
        </form>

        <div className="ml-auto flex flex-shrink-0 items-center text-ink">
          <Link href={user ? "/account" : "/account/login"} aria-label="Account" className="flex h-11 w-11 items-center justify-center">
            <User size={20} />
          </Link>
          <Link href="/account/wishlist" aria-label="Wishlist" className="flex h-11 w-11 items-center justify-center">
            <Heart size={20} />
          </Link>
          <button onClick={() => setOpen(true)} className="relative flex h-11 w-11 items-center justify-center" aria-label="Cart">
            <ShoppingBag size={20} />
            {itemCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-ink/5 lg:hidden">
          <form action="/search" className="flex items-center gap-2 border-b border-ink/5 px-4 py-3">
            <Search size={16} className="flex-shrink-0 text-ink/40" />
            <input name="q" placeholder="Search products…" className="min-h-[44px] w-full bg-transparent text-sm outline-none" />
          </form>
          <nav className="px-2 py-2">
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between">
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="flex min-h-[44px] flex-1 items-center px-2 text-sm font-medium"
                    onClick={() => setMobileOpen(false)}
                  >
                    {cat.name}
                  </Link>
                  {!!cat.children?.length && (
                    <button
                      onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center text-ink/50"
                      aria-label={`Toggle ${cat.name} submenu`}
                      aria-expanded={expanded === cat.id}
                    >
                      <ChevronDown size={16} className={`transition-transform ${expanded === cat.id ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                {expanded === cat.id && !!cat.children?.length && (
                  <div className="ml-3 border-l border-ink/10 pl-3">
                    {cat.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/categories/${child.slug}`}
                        className="flex min-h-[40px] items-center px-2 text-sm text-ink/70"
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link href="/products?featured=true" className="flex min-h-[44px] items-center px-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>
              Featured
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
