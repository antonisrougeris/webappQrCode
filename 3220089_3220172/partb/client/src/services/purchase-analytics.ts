/**
 * GA4 paid-order analytics. Only authenticated backend order data is accepted.
 * Do not infer successful payment from a Viva success redirect or query string.
 */
import { trackEcommerceEvent } from "./analytics";
import { purchaseMetaEventId, trackMetaEvent } from "./metaPixel";

export interface PaidPurchaseOrder {
  id: string;
  orderNumber?: string;
  paymentStatus?: string;
  total?: number;
  subtotal?: number;
  shippingCost?: number;
  recoveryDiscountAmount?: number;
  currency?: string;
  recoveryDiscount?: { code?: string } | null;
  payment?: { transactionId?: string; paidAt?: string };
  items?: Array<{
    productId?: string;
    title?: string;
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
    price?: number;
    priceEUR?: number;
    isFreeReward?: boolean;
    variant?: { sku?: string; size?: string; color?: string } | null;
  }>;
}

export interface PaidPurchaseEvent {
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
    item_variant?: string;
  }>;
  options: {
    value: number;
    currency: string;
    transaction_id: string;
    shipping?: number;
    coupon?: string;
  };
}

const MAX_DELAY_MS = 48 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const roundMoney = (value: number): number => Math.round(value * 100) / 100;
const validMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : null;
};

/**
 * Returns null unless the server reports a recent, verified paid order.
 * GA4 value is discounted merchandise subtotal (excluding shipping).
 * Shipping is a separate GA4 ecommerce parameter.
 */
export function buildPaidPurchaseEvent(
  order: PaidPurchaseOrder | null | undefined,
  now = Date.now()
): PaidPurchaseEvent | null {
  if (!order || order.paymentStatus !== "paid" || !String(order.id || "").trim()) return null;
  if (!String(order.payment?.transactionId || "").trim()) return null;
  const paidAt = Date.parse(String(order.payment?.paidAt || ""));
  if (!Number.isFinite(paidAt) || paidAt > now + MAX_CLOCK_SKEW_MS || now - paidAt > MAX_DELAY_MS) return null;
  const chargedTotal = validMoney(order.total);
  if (chargedTotal === null || chargedTotal <= 0) return null;

  const rawSubtotal = validMoney(order.subtotal);
  const discountAmount = validMoney(order.recoveryDiscountAmount) || 0;
  const preDiscountMerchandise = (order.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unit = validMoney(item.unitPrice ?? item.priceEUR ?? item.price);
    return sum + (Number.isFinite(quantity) && quantity > 0 && unit !== null ? unit * quantity : 0);
  }, 0);
  const ratio = preDiscountMerchandise > 0
    ? Math.min(1, Math.max(0, (preDiscountMerchandise - discountAmount) / preDiscountMerchandise))
    : 1;
  const items = (order.items || []).flatMap(item => {
    const quantity = Number(item.quantity);
    const id = String(item.productId || "").trim();
    const unitPrice = validMoney(item.unitPrice ?? item.priceEUR ?? item.price ??
      (Number(item.lineTotal) / quantity));
    if (!id || !Number.isInteger(quantity) || quantity <= 0 || quantity > 99 || unitPrice === null) return [];
    const variant = [item.variant?.color, item.variant?.size].filter(Boolean).join(" / ");
    return [{
      item_id: id,
      item_name: String(item.title || id),
      price: roundMoney(unitPrice * ratio),
      quantity,
      ...(variant ? { item_variant: variant } : {})
    }];
  });
  if (!items.length) return null;

  const value = rawSubtotal ?? roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const currency = String(order.currency || "EUR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  const shipping = validMoney(order.shippingCost);
  const coupon = String(order.recoveryDiscount?.code || "").trim();
  return {
    items,
    options: {
      transaction_id: String(order.id),
      currency,
      value,
      ...(shipping === null ? {} : { shipping }),
      ...(coupon ? { coupon } : {})
    }
  };
}

export function trackPaidPurchase(order: PaidPurchaseOrder | null | undefined): boolean {
  try {
    const event = buildPaidPurchaseEvent(order);
    if (!event || !order) return false;
    let sent = false;

    const gaKey = "skanare_ga4_purchase:" + order.id;
    if (localStorage.getItem(gaKey) !== "1" &&
        trackEcommerceEvent("purchase", event.items, event.options)) {
      localStorage.setItem(gaKey, "1");
      sent = true;
    }

    // Meta uses the SAME stable event_id as the CAPI webhook for deduplication,
    // regardless of whether the user accepted Google Analytics separately.
    const metaKey = "skanare_meta_purchase:" + order.id;
    if (localStorage.getItem(metaKey) !== "1" &&
        trackMetaEvent("Purchase", event.items, {
          value: event.options.value,
          currency: event.options.currency,
          eventId: purchaseMetaEventId(order.id)
        })) {
      localStorage.setItem(metaKey, "1");
      sent = true;
    }
    return sent;
  } catch {
    // Marketing must never affect order confirmation or payment.
    return false;
  }
}
