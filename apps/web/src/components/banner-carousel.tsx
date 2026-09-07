"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { imgSrc, isSvg } from "@/lib/image";

export interface BannerData {
  id: string;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  textPosition: string;
  theme: string;
}

const ALIGN: Record<string, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

function Slide({ banner, priority }: { banner: BannerData; priority: boolean }) {
  const textColor = banner.theme === "dark" ? "text-ink" : "text-white";
  const content = (
    <div className={`relative flex h-full w-full flex-col justify-center gap-4 px-6 sm:px-16 ${ALIGN[banner.textPosition] ?? ALIGN.left}`}>
      {/* Desktop image */}
      <Image
        src={imgSrc(banner.imageUrl)}
        alt={banner.title}
        fill
        priority={priority}
        sizes="100vw"
        unoptimized={isSvg(banner.imageUrl)}
        className={`object-cover ${banner.mobileImageUrl ? "hidden sm:block" : ""}`}
      />
      {banner.mobileImageUrl && (
        <Image
          src={imgSrc(banner.mobileImageUrl)}
          alt={banner.title}
          fill
          priority={priority}
          sizes="100vw"
          unoptimized={isSvg(banner.mobileImageUrl)}
          className="object-cover sm:hidden"
        />
      )}
      {banner.theme === "dark" ? null : <div className="absolute inset-0 bg-black/20" />}
      <div className={`relative max-w-lg ${textColor}`}>
        <h1 className="font-display text-3xl font-semibold drop-shadow-sm sm:text-5xl">{banner.title}</h1>
        {banner.subtitle && <p className="mt-3 text-sm opacity-90 sm:text-base">{banner.subtitle}</p>}
        {banner.ctaText && <span className="btn-primary mt-6 inline-flex">{banner.ctaText}</span>}
      </div>
    </div>
  );

  return banner.linkUrl ? (
    <Link href={banner.linkUrl} className="absolute inset-0 block">
      {content}
    </Link>
  ) : (
    <div className="absolute inset-0">{content}</div>
  );
}

export function HeroCarousel({ banners }: { banners: BannerData[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="relative h-[60vh] min-h-[380px] w-full overflow-hidden bg-blush">
      {banners.map((b, i) => (
        <div key={b.id} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === active ? 1 : 0, pointerEvents: i === active ? "auto" : "none" }}>
          <Slide banner={b} priority={i === 0} />
        </div>
      ))}

      {banners.length > 1 && (
        <>
          <button
            aria-label="Previous banner"
            onClick={() => setActive((i) => (i - 1 + banners.length) % banners.length)}
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-ink transition hover:bg-white"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Next banner"
            onClick={() => setActive((i) => (i + 1) % banners.length)}
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-ink transition hover:bg-white"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                aria-label={`Go to banner ${i + 1}`}
                onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
