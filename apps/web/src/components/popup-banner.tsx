"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { imgSrc, isSvg } from "@/lib/image";
import { api } from "@/lib/api";
import type { BannerData } from "./banner-carousel";

const DISMISS_KEY_PREFIX = "banner-popup-dismissed:";
const DISMISS_DAYS = 3;

export function PopupBanner() {
  const pathname = usePathname();
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [visible, setVisible] = useState(false);

  const suppressed = pathname?.startsWith("/checkout") || pathname?.startsWith("/account");

  useEffect(() => {
    if (suppressed) return;
    let cancelled = false;
    api.get<BannerData[]>("/api/banners?placement=POPUP").then((banners) => {
      if (cancelled || !banners?.length) return;
      const candidate = banners[0]!;
      try {
        const dismissedAt = localStorage.getItem(DISMISS_KEY_PREFIX + candidate.id);
        if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      } catch {
        // localStorage unavailable (private mode, etc.) — just show it
      }
      setBanner(candidate);
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    });
    return () => {
      cancelled = true;
    };
  }, [suppressed]);

  useEffect(() => {
    if (suppressed) setVisible(false);
  }, [suppressed]);

  function dismiss() {
    setVisible(false);
    if (banner) {
      try {
        localStorage.setItem(DISMISS_KEY_PREFIX + banner.id, String(Date.now()));
      } catch {
        // ignore
      }
    }
  }

  if (!banner || !visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button aria-label="Close" onClick={dismiss} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow">
          <X size={16} />
        </button>
        <div className="relative aspect-square w-full sm:aspect-[4/3]">
          <Image src={imgSrc(banner.imageUrl)} alt={banner.title} fill unoptimized={isSvg(banner.imageUrl)} sizes="448px" className="object-cover" />
        </div>
        <div className="p-5 text-center">
          <h2 className="font-display text-xl">{banner.title}</h2>
          {banner.subtitle && <p className="mt-1 text-sm text-ink/60">{banner.subtitle}</p>}
          {banner.linkUrl && (
            <Link href={banner.linkUrl} onClick={dismiss} className="btn-primary mt-4 inline-flex">
              {banner.ctaText || "Shop Now"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
