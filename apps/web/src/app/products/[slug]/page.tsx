import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverGet } from "@/lib/server-api";
import { ProductDetail } from "@/components/product-detail";
import { ReviewSection } from "@/components/review-section";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { JsonLd, breadcrumbJsonLd } from "@/components/json-ld";
import { imgSrc } from "@/lib/image";
import type { PaginatedResult } from "@ecommerce-x/shared";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface FullProduct {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  description: string | null;
  categoryId: string | null;
  category: { name: string; slug: string } | null;
  brand: { name: string; slug: string; logoUrl: string | null } | null;
  basePrice: string;
  avgRating: string;
  reviewCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  images: { url: string; altText: string | null }[];
  variants: {
    id: string;
    name: string | null;
    options: Record<string, string>;
    price: string;
    compareAtPrice: string | null;
    imageUrl: string | null;
    inventory: { quantityOnHand: number; quantityReserved: number }[];
  }[];
  reviews: {
    id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    verifiedPurchase: boolean;
    createdAt: string;
    user: { firstName: string | null; lastName: string | null };
  }[];
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const product = await serverGet<FullProduct>(`/api/products/${params.slug}`, 120);
  if (!product || product.status !== "ACTIVE") return {};
  const canonical = `${SITE_URL}/products/${product.slug}`;
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.description?.slice(0, 160),
    alternates: { canonical },
    openGraph: {
      images: [product.ogImage ?? imgSrc(product.images[0]?.url ?? "")].filter(Boolean),
    },
  };
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const product = await serverGet<FullProduct>(`/api/products/${params.slug}`, 60);
  // A DRAFT/ARCHIVED product still exists in the DB (unlike a deleted one,
  // which gets a 410 via the Redirect middleware) but must not be indexable
  // or reachable once it's off the storefront listings/sitemap.
  if (!product || product.status !== "ACTIVE") notFound();

  const related = product.category
    ? await serverGet<PaginatedResult<ProductCardData>>(`/api/products?category=${product.category.slug}&pageSize=4`, 60)
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => imgSrc(i.url)),
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "NPR",
      price: product.basePrice,
      availability: product.variants.some((v) => v.inventory.some((i) => i.quantityOnHand > 0))
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    aggregateRating:
      product.reviewCount > 0
        ? { "@type": "AggregateRating", ratingValue: product.avgRating, reviewCount: product.reviewCount }
        : undefined,
  };

  return (
    <div className="container-x py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: SITE_URL },
          ...(product.category
            ? [{ name: product.category.name, url: `${SITE_URL}/categories/${product.category.slug}` }]
            : []),
          { name: product.name, url: `${SITE_URL}/products/${product.slug}` },
        ])}
      />

      <nav className="mb-6 text-xs text-ink/50">
        <a href="/" className="hover:text-brand">Home</a> /{" "}
        {product.category && (
          <>
            <a href={`/categories/${product.category.slug}`} className="hover:text-brand">{product.category.name}</a> /{" "}
          </>
        )}
        <span className="text-ink/70">{product.name}</span>
      </nav>

      <ProductDetail productId={product.id} productName={product.name} images={product.images} variants={product.variants} brand={product.brand} />

      {product.description && (
        <div className="mt-14 max-w-3xl">
          <h2 className="font-display text-2xl">Description</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">{product.description}</p>
        </div>
      )}

      <ReviewSection productId={product.id} initialReviews={product.reviews} avgRating={product.avgRating} reviewCount={product.reviewCount} />

      {!!related?.items.length && (
        <div className="mt-16">
          <h2 className="mb-6 font-display text-2xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {related.items.filter((p) => p.id !== product.id).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
