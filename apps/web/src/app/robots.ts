import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/account",
          "/checkout",
          "/cart",
          // Faceted-nav / infinite-parameter-combination URLs: these already
          // self-canonicalize or set robots:noindex in generateMetadata, but
          // blocking crawl outright saves crawl budget for real pages.
          "/*?*search=",
          "/*?*minPrice=",
          "/*?*maxPrice=",
          "/*?*sort=",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
