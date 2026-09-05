export interface PublicSettings {
  branding: {
    siteName?: string;
    tagline?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  contact: { email?: string; phone?: string; address?: string };
  social: { facebook?: string; instagram?: string; tiktok?: string };
  general: { currency?: string; maintenanceMode?: boolean };
  seo: { defaultTitle?: string; defaultDescription?: string; defaultOgImage?: string };
  integrations: {
    metaPixelId?: string;
    gtmContainerId?: string;
    ga4MeasurementId?: string;
    googleSiteVerification?: string;
    bingSiteVerification?: string;
  };
  payments: Record<string, { enabled: boolean; mode: string }>;
}

export const DEFAULT_SETTINGS: PublicSettings = {
  branding: { siteName: "EDC Beauty & Fashion", primaryColor: "#C2185B", secondaryColor: "#1A1A1A" },
  contact: {},
  social: {},
  general: { currency: "NPR" },
  seo: { defaultTitle: "EDC Beauty & Fashion", defaultDescription: "Cosmetics & Fashion in Nepal" },
  integrations: {},
  payments: {},
};
