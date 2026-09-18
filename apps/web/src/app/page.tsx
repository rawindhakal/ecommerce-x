import Link from "next/link";
import Image from "next/image";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { imgSrc } from "@/lib/image";
import { HeroCarousel, type BannerData } from "@/components/banner-carousel";
import { PromoGrid } from "@/components/promo-grid";
import { BuilderRenderer } from "@/components/builder/renderer";
import { HOME_PAGE_SLUG, type BuilderTree, type PaginatedResult } from "@ecommerce-x/shared";

interface HomeBuilderPage {
  status: "DRAFT" | "PUBLISHED";
  layoutJson: BuilderTree | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export default async function HomePage() {
  const homeBuilderPage = await serverGet<HomeBuilderPage>(`/api/pages/${HOME_PAGE_SLUG}`, 30);
  if (homeBuilderPage?.status === "PUBLISHED" && homeBuilderPage.layoutJson?.length) {
    return <BuilderRenderer tree={homeBuilderPage.layoutJson} />;
  }

  const [heroBanners, promoBanners, categories, brands, featured, bestsellers, newArrivals] = await Promise.all([
    serverGet<BannerData[]>("/api/banners?placement=HOME_HERO", 60).then((b) => b ?? []),
    serverGet<BannerData[]>("/api/banners?placement=HOME_PROMO", 60).then((b) => b ?? []),
    serverGet<Category[]>("/api/categories", 120).then((c) => c ?? []),
    serverGet<Brand[]>("/api/brands", 120).then((b) => b ?? []),
    serverGet<PaginatedResult<ProductCardData>>("/api/products?featured=true&pageSize=8", 60),
    serverGet<PaginatedResult<ProductCardData>>("/api/products?sort=rating&pageSize=8", 60),
    serverGet<PaginatedResult<ProductCardData>>("/api/products?sort=newest&pageSize=8", 60),
  ]);

  return (
    <div>
      <section className="relative">
        {heroBanners.length > 0 ? (
          <HeroCarousel banners={heroBanners} />
        ) : (
          <div className="flex h-[55vh] min-h-[380px] w-full flex-col items-center justify-center bg-gradient-to-br from-blush to-cream text-center">
            <h1 className="font-display text-4xl font-semibold text-ink md:text-6xl">Beauty & Style, Delivered.</h1>
            <p className="mt-4 max-w-lg text-ink/60">Discover makeup, skincare, and fashion essentials curated for you.</p>
            <Link href="/products" className="btn-primary mt-8">
              Shop Now
            </Link>
          </div>
        )}
      </section>

      {categories.length > 0 && (
        <section className="container-x py-14">
          <h2 className="mb-6 font-display text-2xl">Shop by Category</h2>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group relative w-36 flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-blush sm:w-44"
              >
                <div className="relative aspect-square">
                  {cat.imageUrl ? (
                    <Image src={imgSrc(cat.imageUrl)} alt={cat.name} fill unoptimized sizes="176px" className="object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-lg text-ink/40">{cat.name}</div>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                  <span className="text-sm font-medium text-white">{cat.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!!featured?.items.length && (
        <section className="container-x py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-2xl">Featured Picks</h2>
            <Link href="/products?featured=true" className="text-sm font-medium text-brand">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {!!bestsellers?.items.length && (
        <section className="bg-blush/40 py-10">
          <div className="container-x">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="font-display text-2xl">Bestsellers</h2>
              <Link href="/products?sort=rating" className="text-sm font-medium text-brand">
                View all
              </Link>
            </div>
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {bestsellers.items.map((p) => (
                <div key={p.id} className="w-40 flex-shrink-0 snap-start sm:w-auto">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PromoGrid banners={promoBanners} />

      {!!newArrivals?.items.length && (
        <section className="container-x py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-2xl">New Arrivals</h2>
            <Link href="/products?sort=newest" className="text-sm font-medium text-brand">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {newArrivals.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {brands.length > 0 && (
        <section className="container-x py-10">
          <h2 className="mb-6 font-display text-2xl">Shop by Brand</h2>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`/products?brand=${b.slug}`}
                className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-white p-3 transition hover:border-brand/40 hover:shadow-sm"
              >
                {b.logoUrl ? (
                  <span className="relative h-full w-full">
                    <Image src={imgSrc(b.logoUrl)} alt={b.name} fill unoptimized className="object-contain" />
                  </span>
                ) : (
                  <span className="text-center text-sm font-medium text-ink/70">{b.name}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-x grid grid-cols-1 gap-6 py-14 sm:grid-cols-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <Truck size={26} className="text-brand" />
          <h3 className="font-display text-lg">Free Delivery</h3>
          <p className="text-sm text-ink/60">On orders above Rs. 3,000 in Kathmandu Valley</p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <RotateCcw size={26} className="text-brand" />
          <h3 className="font-display text-lg">Easy Returns</h3>
          <p className="text-sm text-ink/60">7-day hassle-free returns on eligible items</p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck size={26} className="text-brand" />
          <h3 className="font-display text-lg">Secure Payments</h3>
          <p className="text-sm text-ink/60">eSewa, Fonepay, and card payments supported</p>
        </div>
      </section>
    </div>
  );
}
