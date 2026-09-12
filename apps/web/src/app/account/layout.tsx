"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/loyalty", label: "GlowPoints" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, initialized, fetchMe, logout } = useAuthStore();
  const isAuthPage = pathname === "/account/login" || pathname === "/account/register";

  useEffect(() => {
    if (!initialized) fetchMe();
  }, [initialized, fetchMe]);

  useEffect(() => {
    if (initialized && !user && !isAuthPage) router.push("/account/login");
  }, [initialized, user, isAuthPage, router]);

  if (isAuthPage) return <>{children}</>;
  if (!user) return <div className="container-x py-20 text-center text-ink/50">Loading…</div>;

  return (
    <div className="container-x grid grid-cols-1 gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-1">
        <p className="mb-3 text-sm font-medium text-ink/60">Hi, {user.firstName}</p>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg px-3 py-2 text-sm ${pathname === item.href ? "bg-brand/10 text-brand" : "text-ink/70 hover:bg-ink/5"}`}
          >
            {item.label}
          </Link>
        ))}
        <button onClick={() => logout().then(() => router.push("/"))} className="mt-3 block w-full rounded-lg px-3 py-2 text-left text-sm text-ink/50 hover:bg-ink/5">
          Sign Out
        </button>
      </aside>
      <div>{children}</div>
    </div>
  );
}
