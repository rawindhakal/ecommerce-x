import Link from "next/link";
import Image from "next/image";
import { imgSrc, isSvg } from "@/lib/image";
import type { BannerData } from "./banner-carousel";

export function PromoGrid({ banners }: { banners: BannerData[] }) {
  if (banners.length === 0) return null;

  const cols = banners.length === 1 ? "sm:grid-cols-1" : banners.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <section className="container-x py-6">
      <div className={`grid grid-cols-1 gap-4 ${cols}`}>
        {banners.map((b) => (
          <Link key={b.id} href={b.linkUrl ?? "/products"} className="group relative block overflow-hidden rounded-2xl">
            <div className={`relative h-48 w-full ${banners.length === 1 ? "md:h-64" : "md:h-56"}`}>
              <Image src={imgSrc(b.imageUrl)} alt={b.title} fill unoptimized={isSvg(b.imageUrl)} sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
              {(b.title || b.subtitle || b.ctaText) && (
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent p-4">
                  <h3 className="font-display text-lg text-white">{b.title}</h3>
                  {b.subtitle && <p className="text-xs text-white/80">{b.subtitle}</p>}
                  {b.ctaText && <span className="mt-2 inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">{b.ctaText}</span>}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
