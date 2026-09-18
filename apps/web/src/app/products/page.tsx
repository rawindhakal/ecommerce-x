import type { Metadata } from "next";
import { serverGet } from "@/lib/server-api";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { SortSelect, BrandFilter, MultiChipFilter, PriceRangeFilter, Pagination } from "@/components/product-filters";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import { MobileFilterDrawer } from "@/components/mobile-filter-drawer";
import { AppliedFilters } from "@/components/applied-filters";
import type { PaginatedResult } from "@ecommerce-x/shared";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface Facets {
  priceRange: { min: number; max: number };
  tags: string[];
  variantOptions: Record<string, string[]>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(props: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
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

export default async function ProductsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  // Forward every param as-is — the API treats anything it doesn't
  // recognize as a variant-attribute facet (e.g. ?shade=Nude+02), so there's
  // no fixed list of filter keys to enumerate here.
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") qs.set(key, value);
  }
  qs.set("page", searchParams.page ?? "1");
  qs.set("pageSize", "12");

  const [result, brands, facets] = await Promise.all([
    serverGet<PaginatedResult<ProductCardData>>(`/api/products?${qs.toString()}`, 30),
    serverGet<Brand[]>("/api/brands", 120).then((b) => b ?? []),
    serverGet<Facets>("/api/products/facets", 60),
  ]);

  // Only page 1's first row sits above the fold on initial load — later
  // pages are reached by pagination/scroll, so lazy-load those normally.
  const isFirstPage = (searchParams.page ?? "1") === "1";

  return (
    <div className="container-x py-10">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", url: SITE_URL }, { name: "Shop All", url: `${SITE_URL}/products` }])} />
      <div className="mb-8 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{searchParams.search ? `Results for "${searchParams.search}"` : "Shop All"}</h1>
        <SortSelect />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <MobileFilterDrawer>
          <BrandFilter brands={brands} />
          {facets && <PriceRangeFilter min={facets.priceRange.min} max={facets.priceRange.max} />}
          {facets && <MultiChipFilter paramKey="tags" label="Tags" options={facets.tags} />}
          {facets &&
            Object.entries(facets.variantOptions).map(([key, values]) => (
              <MultiChipFilter key={key} paramKey={key} label={key.charAt(0).toUpperCase() + key.slice(1)} options={values} />
            ))}
        </MobileFilterDrawer>

        <div>
          <AppliedFilters brands={brands} />
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
