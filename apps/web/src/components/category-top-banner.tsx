import Link from "next/link";
import Image from "next/image";
import { imgSrc, isSvg } from "@/lib/image";
import type { BannerData } from "./banner-carousel";

const ALIGN: Record<string, string> = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" };

export function CategoryTopBanner({ banner }: { banner: BannerData }) {
  const textColor = banner.theme === "dark" ? "text-ink" : "text-white";
  const inner = (
    <div className="relative h-40 w-full overflow-hidden rounded-2xl sm:h-56">
      <Image src={imgSrc(banner.imageUrl)} alt={banner.title} fill priority sizes="100vw" unoptimized={isSvg(banner.imageUrl)} className="object-cover" />
      {banner.theme !== "dark" && <div className="absolute inset-0 bg-black/20" />}
      <div className={`relative flex h-full flex-col justify-center gap-1 px-6 ${ALIGN[banner.textPosition] ?? ALIGN.left} ${textColor}`}>
        <h2 className="font-display text-xl sm:text-2xl">{banner.title}</h2>
        {banner.subtitle && <p className="text-xs opacity-90 sm:text-sm">{banner.subtitle}</p>}
        {banner.ctaText && <span className="btn-primary mt-2 inline-flex w-fit">{banner.ctaText}</span>}
      </div>
    </div>
  );
  return (
    <div className="mb-8">
      {banner.linkUrl ? <Link href={banner.linkUrl}>{inner}</Link> : inner}
    </div>
  );
}
