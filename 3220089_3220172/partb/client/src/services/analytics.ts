/**
 * Independent ecommerce event pipelines:
 * - this module's GA4 success boolean means GA4 alone was queued;
 * - Meta uses a distinct helper and must never mark a GA4 event as sent.
 */
import { loadGoogleAnalytics } from "../components/cookieConsent";
import { hasAnalyticsConsent } from "./cookiePreferences";
import { trackMetaEvent } from "./metaPixel";

export type EcommerceItem = {
  item_id: string; item_name?: string; price?: number; quantity?: number;
  item_variant?: string; item_sku?: string;
};
export type EcommerceEventName = "view_item" | "add_to_cart" | "begin_checkout" | "purchase";
type EcommerceOptions = {
  value?: number; currency?: string; transaction_id?: string;
  shipping?: number; coupon?: string;
};

export function trackMetaEcommerceEvent(
  eventName: Exclude<EcommerceEventName, "purchase">,
  items: EcommerceItem[],
  options: Pick<EcommerceOptions, "value" | "currency"> = {}
): boolean {
  if (!items.length) return false;
  const eventMap = {
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout"
  } as const;
  try {
    return trackMetaEvent(eventMap[eventName], items, options);
  } catch {
    return false;
  }
}

/**
 * Only GA4 success determines this return value. Meta tracking is called
 * independently so a Meta success can never suppress a GA4 event (or purchase).
 */
export function trackEcommerceEvent(
  eventName: EcommerceEventName,
  items: EcommerceItem[],
  options: EcommerceOptions = {}
): boolean {
  try {
    if (!items.length || !hasAnalyticsConsent()) return false;
    loadGoogleAnalytics();
    if (typeof window.gtag !== "function") return false;
    const value = options.value ?? items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0
    );
    if (!Number.isFinite(value) || value < 0) return false;
    window.gtag("event", eventName, {
      currency: options.currency || "EUR",
      value: Math.round(value * 100) / 100,
      items,
      ...(options.transaction_id ? { transaction_id: options.transaction_id } : {}),
      ...(options.shipping !== undefined ? { shipping: options.shipping } : {}),
      ...(options.coupon ? { coupon: options.coupon } : {})
    });
    return true;
  } catch {
    // Instrumentation must never interrupt real ecommerce operations.
    return false;
  }
}
