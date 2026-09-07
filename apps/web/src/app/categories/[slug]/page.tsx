import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverGet } from "@/lib/server-api";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { SortSelect, Pagination } from "@/components/product-filters";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import { CategoryTopBanner } from "@/components/category-top-banner";
import type { BannerData } from "@/components/banner-carousel";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | undefined>>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const category = await serverGet<Category>(`/api/categories/${params.slug}`, 300);
  if (!category) return {};

  // Self-referencing canonical per page — a deeper page is genuinely
  // different content (different products) and must not collapse to page 1.
  // Sort/other facet params are canonicalized away since they only reorder
  // the same underlying set.
  const page = Number(searchParams.page ?? "1");
  const canonical = page > 1 ? `${SITE_URL}/categories/${category.slug}?page=${page}` : `${SITE_URL}/categories/${category.slug}`;

  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? undefined,
    alternates: { canonical },
    openGraph: category.ogImage ? { images: [category.ogImage] } : undefined,
  };
}

export default async function CategoryPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const category = await serverGet<Category>(`/api/categories/${params.slug}`, 60);
  if (!category) notFound();

  const qs = new URLSearchParams({ category: params.slug, page: searchParams.page ?? "1", pageSize: "12" });
  if (searchParams.sort) qs.set("sort", searchParams.sort);

  const [result, topBanners] = await Promise.all([
    serverGet<PaginatedResult<ProductCardData>>(`/api/products?${qs.toString()}`, 30),
    serverGet<BannerData[]>(`/api/banners?placement=CATEGORY_TOP&categorySlug=${category.slug}`, 60).then((b) => b ?? []),
  ]);

  return (
    <div className="container-x py-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          { name: category.name, url: `${SITE_URL}/categories/${category.slug}` },
        ])}
      />
      {topBanners[0] && <CategoryTopBanner banner={topBanners[0]} />}

      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl">{category.name}</h1>
          {category.description && <p className="mt-2 max-w-2xl text-sm text-ink/60">{category.description}</p>}
        </div>
        <SortSelect />
      </div>

      {!result || result.items.length === 0 ? (
        <p className="py-20 text-center text-ink/50">No products in this category yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {result.items.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={(searchParams.page ?? "1") === "1" && i < 4} />
            ))}
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} />
        </>
      )}
    </div>
  );
}
