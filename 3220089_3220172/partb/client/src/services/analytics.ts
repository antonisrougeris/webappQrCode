/** GA4 ecommerce events: no tracking before explicit analytics consent. */
import { loadGoogleAnalytics } from "../components/cookieConsent";

type EcommerceItem = { item_id: string; item_name?: string; price?: number; quantity?: number; item_variant?: string };
const CONSENT_KEY = "skanare_cookie_consent";

export function trackEcommerceEvent(
  eventName: "view_item" | "add_to_cart" | "begin_checkout" | "purchase",
  items: EcommerceItem[],
  options: { value?: number; currency?: string; transaction_id?: string; shipping?: number; coupon?: string } = {}
): boolean {
  try {
    if (localStorage.getItem(CONSENT_KEY) !== "accepted" || !items.length) return false;
    loadGoogleAnalytics();
    if (typeof window.gtag !== "function") return false;
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
    return false;
  }
}
