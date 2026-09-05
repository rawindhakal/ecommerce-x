import type { MetadataRoute } from "next";
import { serverGet } from "@/lib/server-api";
import type { PaginatedResult } from "@ecommerce-x/shared";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface SlugItem {
  slug: string;
  updatedAt?: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, pages] = await Promise.all([
    serverGet<PaginatedResult<SlugItem>>("/api/products?pageSize=200", 3600),
    serverGet<SlugItem[]>("/api/categories", 3600),
    serverGet<SlugItem[]>("/api/pages", 3600),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.8 },
  ];

  for (const p of products?.items ?? []) {
    entries.push({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const c of categories ?? []) {
    entries.push({ url: `${SITE_URL}/categories/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const pg of pages ?? []) {
    entries.push({ url: `${SITE_URL}/pages/${pg.slug}`, changeFrequency: "monthly", priority: 0.4 });
  }

  return entries;
}
