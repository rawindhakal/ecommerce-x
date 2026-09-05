declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

/** Fires a GA4-shaped ecommerce event to GTM's dataLayer, and mirrors it to Meta Pixel when possible. */
export function trackEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });

  const fbqEventMap: Record<string, string> = {
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
    purchase: "Purchase",
    search: "Search",
    add_to_wishlist: "AddToWishlist",
  };
  const fbEvent = fbqEventMap[event];
  if (fbEvent && window.fbq) {
    window.fbq("track", fbEvent, params);
  }
}
