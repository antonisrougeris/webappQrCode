import { hasMarketingConsent } from "./cookiePreferences";

export type MetaEventName = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";
export type MetaItem = { item_id: string; item_name?: string; price?: number; quantity?: number };
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void; queue?: unknown[][];
  loaded?: boolean; version?: string;
};
declare global { interface Window { fbq?: Pixel } }

const configuredPixelId = (): string => {
  const id = String(import.meta.env.VITE_META_PIXEL_ID || "").trim();
  return /^\d{8,25}$/.test(id) ? id : "";
};

/** No Facebook network request or cookies before affirmative marketing consent. */
export function loadMetaPixel(): boolean {
  if (!hasMarketingConsent() || !configuredPixelId()) return false;
  if (typeof window.fbq !== "function") {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    }) as Pixel;
    fbq.queue = []; fbq.loaded = true; fbq.version = "2.0";
    window.fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.skanareMetaPixel = "true";
    document.head.appendChild(script);
    fbq("init", configuredPixelId());
    fbq("track", "PageView");
  }
  return true;
}

export function purchaseMetaEventId(orderId: string): string {
  return "skanare_purchase_" + String(orderId).trim();
}

export function trackMetaEvent(
  event: MetaEventName,
  items: MetaItem[],
  options: { value?: number; currency?: string; eventId?: string } = {}
): boolean {
  if (!loadMetaPixel() || !items.length) return false;
  const filtered = items.filter(item => item.item_id && Number(item.quantity || 1) > 0);
  if (!filtered.length) return false;
  const value = options.value ?? filtered.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  if (!Number.isFinite(value) || value < 0) return false;
  const eventID = options.eventId || crypto.randomUUID();
  try {
    window.fbq?.("track", event, {
      content_type: "product",
      content_ids: filtered.map(item => item.item_id),
      contents: filtered.map(item => ({
        id: item.item_id, quantity: Number(item.quantity || 1),
        item_price: Number(item.price || 0)
      })),
      num_items: filtered.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
      value: Math.round(value * 100) / 100,
      currency: options.currency || "EUR"
    }, { eventID });
    return true;
  } catch { return false; }
}
