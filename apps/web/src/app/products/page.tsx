import type { Metadata } from "next";
import { serverGet } from "@/lib/server-api";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { SortSelect, BrandFilter, Pagination } from "@/components/product-filters";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ searchParams }: { searchParams: Record<string, string | undefined> }): Promise<Metadata> {
  const { category, brand, search, minPrice, maxPrice, page } = searchParams;
  const pageNum = Number(page ?? "1");

  // Faceted-navigation consolidation: /products?category=x is a duplicate of
  // the dedicated /categories/x page — canonicalize to the real page instead
  // of letting both get indexed as separate URLs for the same content.
  if (category) {
    const canonical = pageNum > 1 ? `${SITE_URL}/categories/${category}?page=${pageNum}` : `${SITE_URL}/categories/${category}`;
    return { title: "Shop All", alternates: { canonical } };
  }

  // Search results and price-range facets are effectively infinite parameter
  // combinations with no standalone SEO value — keep them crawlable (so
  // internal links still pass through) but out of the index.
  if (search || minPrice || maxPrice) {
    return { title: search ? `Results for "${search}"` : "Shop All", robots: { index: false, follow: true } };
  }

  // Plain listing / brand filter / sort: brand is a real, worthwhile facet
  // (no dedicated page for it) so it stays in the canonical; sort doesn't
  // create distinct content so it's dropped. Each page self-canonicalizes.
  const params = new URLSearchParams();
  if (brand) params.set("brand", brand);
  if (pageNum > 1) params.set("page", String(pageNum));
  const qs = params.toString();
  return { title: "Shop All", alternates: { canonical: `${SITE_URL}/products${qs ? `?${qs}` : ""}` } };
}

export default async function ProductsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const qs = new URLSearchParams();
  for (const key of ["category", "brand", "search", "featured", "sort", "minPrice", "maxPrice", "tag"]) {
    if (searchParams[key]) qs.set(key, searchParams[key]!);
  }
  qs.set("page", searchParams.page ?? "1");
  qs.set("pageSize", "12");

  const [result, brands] = await Promise.all([
    serverGet<PaginatedResult<ProductCardData>>(`/api/products?${qs.toString()}`, 30),
    serverGet<Brand[]>("/api/brands", 120).then((b) => b ?? []),
  ]);

  // Only page 1's first row sits above the fold on initial load — later
  // pages are reached by pagination/scroll, so lazy-load those normally.
  const isFirstPage = (searchParams.page ?? "1") === "1";

  return (
    <div className="container-x py-10">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", url: SITE_URL }, { name: "Shop All", url: `${SITE_URL}/products` }])} />
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl">{searchParams.search ? `Results for "${searchParams.search}"` : "Shop All"}</h1>
        <SortSelect />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-6">
          <BrandFilter brands={brands} />
        </aside>

        <div>
          {!result || result.items.length === 0 ? (
            <p className="py-20 text-center text-ink/50">No products found.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                {result.items.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={isFirstPage && i < 4} />
                ))}
              </div>
              <Pagination page={result.page} totalPages={result.totalPages} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
