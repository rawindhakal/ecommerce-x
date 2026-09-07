"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  ShoppingCart,
  Users,
  Ticket,
  Star,
  Boxes,
  Store,
  FileText,
  Image as ImageIcon,
  Menu as MenuIcon,
  Settings,
  LogOut,
  BarChart3,
  X,
  Search,
  ScrollText,
  DatabaseBackup,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";

const FULL_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/brands", label: "Brands", icon: Tag },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/coupons", label: "Coupons", icon: Ticket },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/pos", label: "POS", icon: Store },
  { href: "/cms/pages", label: "Pages", icon: FileText },
  { href: "/cms/banners", label: "Banners", icon: ImageIcon },
  { href: "/cms/menus", label: "Menus", icon: MenuIcon },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

const SUPERADMIN_ONLY_NAV = [{ href: "/backup", label: "Backup & Restore", icon: DatabaseBackup }];

const CASHIER_NAV = [{ href: "/pos", label: "POS", icon: Store }];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, initialized, fetchMe, logout } = useAuthStore();
  const [siteName, setSiteName] = useState("Store Admin");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!initialized) fetchMe();
  }, [initialized, fetchMe]);

  useEffect(() => {
    if (initialized && !user) router.push("/login");
  }, [initialized, user, router]);

  useEffect(() => {
    api.get<{ branding?: { siteName?: string } }>("/api/settings/public").then((s) => {
      if (s.branding?.siteName) setSiteName(s.branding.siteName);
    });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!initialized || !user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  const nav = user.role === "POS_CASHIER" ? CASHIER_NAV : user.role === "SUPERADMIN" ? [...FULL_NAV, ...SUPERADMIN_ONLY_NAV] : FULL_NAV;
  const currentLabel = nav.find((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)))?.label ?? "";

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <div>
          <h1 className="text-base font-semibold leading-tight text-brand-600">{siteName}</h1>
          <p className="text-xs text-slate-400">Admin Panel</p>
        </div>
        <button className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                active ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <p className="truncate px-3 text-xs text-slate-400">{user.phone ?? user.email}</p>
        <button
          onClick={() => logout().then(() => router.push("/login"))}
          className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">{sidebarContent}</aside>

      {/* Mobile off-canvas drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[80vw] flex-col bg-white shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50"
            aria-label="Open menu"
          >
            <MenuIcon size={20} />
          </button>
          <span className="truncate text-base font-semibold">{currentLabel || siteName}</span>
        </header>
        <main className="flex-1 overflow-x-hidden bg-slate-50 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
