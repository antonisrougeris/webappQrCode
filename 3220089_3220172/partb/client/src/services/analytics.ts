/** GA4 ecommerce events: no tracking before explicit analytics consent. */
import { loadGoogleAnalytics } from "../components/cookieConsent";
import { hasAnalyticsConsent } from "./cookiePreferences";
import { trackMetaEvent } from "./metaPixel";

type EcommerceItem = { item_id: string; item_name?: string; price?: number; quantity?: number; item_variant?: string; item_sku?: string };


export function trackEcommerceEvent(
  eventName: "view_item" | "add_to_cart" | "begin_checkout" | "purchase",
  items: EcommerceItem[],
  options: { value?: number; currency?: string; transaction_id?: string; shipping?: number; coupon?: string } = {}
): boolean {
  let metaSent = false;
  try {
    if (!items.length) return false;
    const eventMap = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" } as const;
    // Marketing tracking is completely independent of analytics opt-in.
    if (eventName !== "purchase") metaSent = trackMetaEvent(eventMap[eventName], items, { value: options.value, currency: options.currency });
    if (!hasAnalyticsConsent()) return metaSent;
    loadGoogleAnalytics();
    if (typeof window.gtag !== "function") return metaSent;
    const value = options.value ?? items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    window.gtag("event", eventName, {
      currency: options.currency || "EUR",
      value: Math.round(value * 100) / 100,
      items,
      ...(options.transaction_id ? { transaction_id: options.transaction_id } : {}),
      ...(options.shipping !== undefined ? { shipping: options.shipping } : {}),
      ...(options.coupon ? { coupon: options.coupon } : {}),
    });
    return true;
  } catch {
    // Analytics must never interfere with checkout or cart.
    return metaSent;
  }
}
