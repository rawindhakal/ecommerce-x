import Link from "next/link";
import Image from "next/image";
import { serverGet } from "@/lib/server-api";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { imgSrc, isSvg } from "@/lib/image";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  placement: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export default async function HomePage() {
  const [heroBanners, promoBanners, categories, featured, newArrivals] = await Promise.all([
    serverGet<Banner[]>("/api/banners?placement=HOME_HERO", 60).then((b) => b ?? []),
    serverGet<Banner[]>("/api/banners?placement=HOME_PROMO", 60).then((b) => b ?? []),
    serverGet<Category[]>("/api/categories", 120).then((c) => c ?? []),
    serverGet<PaginatedResult<ProductCardData>>("/api/products?featured=true&pageSize=8", 60),
    serverGet<PaginatedResult<ProductCardData>>("/api/products?sort=newest&pageSize=8", 60),
  ]);

  const hero = heroBanners[0];

  return (
    <div>
      <section className="relative">
        {hero ? (
          <Link href={hero.linkUrl ?? "/products"} className="block">
            <div className="relative h-[60vh] min-h-[380px] w-full overflow-hidden bg-blush">
              <Image src={imgSrc(hero.imageUrl)} alt={hero.title} fill priority sizes="100vw" unoptimized={isSvg(hero.imageUrl)} className="object-cover" />
            </div>
          </Link>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.slice(0, 8).map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.slug}`} className="group relative overflow-hidden rounded-2xl bg-blush">
                <div className="relative aspect-square">
                  {cat.imageUrl ? (
                    <Image src={imgSrc(cat.imageUrl)} alt={cat.name} fill unoptimized className="object-cover transition group-hover:scale-105" />
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

      {promoBanners[0] && (
        <section className="container-x py-6">
          <Link href={promoBanners[0].linkUrl ?? "/products"} className="relative block overflow-hidden rounded-2xl">
            <div className="relative h-48 w-full md:h-64">
              <Image src={imgSrc(promoBanners[0].imageUrl)} alt={promoBanners[0].title} fill unoptimized className="object-cover" />
            </div>
          </Link>
        </section>
      )}

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

      <section className="container-x grid grid-cols-1 gap-6 py-14 text-center sm:grid-cols-3">
        <div>
          <h3 className="font-display text-lg">Free Delivery</h3>
          <p className="mt-1 text-sm text-ink/60">On orders above Rs. 3,000 in Kathmandu Valley</p>
        </div>
        <div>
          <h3 className="font-display text-lg">Easy Returns</h3>
          <p className="mt-1 text-sm text-ink/60">7-day hassle-free returns on eligible items</p>
        </div>
        <div>
          <h3 className="font-display text-lg">Secure Payments</h3>
          <p className="mt-1 text-sm text-ink/60">eSewa, Fonepay, and card payments supported</p>
        </div>
      </section>
    </div>
  );
}
