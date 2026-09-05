import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { serverGet } from "@/lib/server-api";
import { DEFAULT_SETTINGS, type PublicSettings } from "@/lib/settings";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";
import { Analytics, GtmNoScript } from "@/components/analytics";
import { hexToRgbChannels } from "@/lib/color";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap" });

async function getSettings(): Promise<PublicSettings> {
  const settings = await serverGet<PublicSettings>("/api/settings/public", 60);
  return settings ?? DEFAULT_SETTINGS;
}

interface CategoryTree {
  id: string;
  name: string;
  slug: string;
  children: CategoryTree[];
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: settings.seo.defaultTitle ?? settings.branding.siteName ?? "Store", template: `%s | ${settings.branding.siteName ?? "Store"}` },
    description: settings.seo.defaultDescription,
    icons: settings.branding.faviconUrl ? [{ url: settings.branding.faviconUrl }] : undefined,
    openGraph: {
      siteName: settings.branding.siteName,
      images: settings.seo.defaultOgImage ? [settings.seo.defaultOgImage] : undefined,
    },
    // Search Console / Bing site-ownership verification, set from Admin →
    // Settings → Integrations — no code changes needed to add/rotate them.
    verification: {
      google: settings.integrations.googleSiteVerification || undefined,
      other: settings.integrations.bingSiteVerification ? { "msvalidate.01": settings.integrations.bingSiteVerification } : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([
    getSettings(),
    serverGet<CategoryTree[]>("/api/categories?tree=true", 120).then((c) => c ?? []),
  ]);

  const topLevel = categories.filter((c) => !("parentId" in c) || true).slice(0, 6);

  return (
    <html
      lang="en"
      style={{
        ["--color-primary-rgb" as string]: hexToRgbChannels(settings.branding.primaryColor, "194 24 91"),
        ["--color-secondary-rgb" as string]: hexToRgbChannels(settings.branding.secondaryColor, "26 26 26"),
      }}
    >
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <Analytics
          gtmContainerId={settings.integrations.gtmContainerId}
          metaPixelId={settings.integrations.metaPixelId}
          ga4MeasurementId={settings.integrations.ga4MeasurementId}
        />
        <GtmNoScript gtmContainerId={settings.integrations.gtmContainerId} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: settings.branding.siteName,
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
              logo: settings.branding.logoUrl,
              sameAs: [settings.social.facebook, settings.social.instagram].filter(Boolean),
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: settings.branding.siteName,
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
              potentialAction: {
                "@type": "SearchAction",
                target: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />

        <Header settings={settings} categories={topLevel} />
        <main className="min-h-[60vh]">{children}</main>
        <Footer settings={settings} />
        <CartDrawer />
      </body>
    </html>
  );
}
