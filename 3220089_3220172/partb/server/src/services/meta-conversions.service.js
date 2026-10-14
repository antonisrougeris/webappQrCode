/**
 * Server-side Meta Conversions API. No request without a checkout-time,
 * affirmative marketing consent snapshot. Secrets live ONLY in server.env.
 * Runs after verified Viva webhook, never before payment.
 */
import crypto from "node:crypto";

const eventID = orderId => "skanare_purchase_" + String(orderId || "").trim();

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export function buildMetaPurchase(order, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (order?.paymentStatus !== "paid" || !order?.marketingConsent?.granted ||
      !order.id || !order.payment?.transactionId) return null;
  const email = String(order.customer?.email || "").trim().toLowerCase();
  // Explicit consent, no raw PII transmitted to Meta.
  const hashedEmail = email.includes("@")
    ? crypto.createHash("sha256").update(email).digest("hex")
    : "";
  const items = Array.isArray(order.items) ? order.items : [];
  const contents = items.filter(item => item.productId && Number(item.quantity) > 0).map(item => ({
    id: String(item.productId) + (item.variant?.sku ? "::" + String(item.variant.sku) : ""),
    quantity: Number(item.quantity),
    item_price: numeric(item.unitPrice ?? item.price ?? item.priceEUR)
  }));
  if (!contents.length) return null;
  const subtotal = numeric(order.subtotal);
  return {
    event_name: "Purchase",
    event_time: nowSeconds,
    event_id: eventID(order.id),
    action_source: "website",
    event_source_url: "https://skanare.com/payment/success",
    user_data: hashedEmail ? { em: [hashedEmail] } : {},
    custom_data: {
      currency: "EUR",
      value: subtotal,
      content_type: "product",
      content_ids: contents.map(item => item.id),
      contents,
      num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
      order_id: String(order.id)
    }
  };
}

export async function sendMetaPurchaseForPaidOrder(order, options = {}) {
  const pixelId = String(process.env.META_PIXEL_ID || "").trim();
  const token = String(process.env.META_CAPI_ACCESS_TOKEN || "").trim();
  if (!/^\d{8,25}$/.test(pixelId) || !token) return { sent: false, reason: "not_configured" };
  const event = buildMetaPurchase(order);
  if (!event) return { sent: false, reason: "no_consent_or_unpaid" };
  if (order.metaPurchase?.sentAt) return { sent: false, reason: "already_sent" };

  const endpoint = `https://graph.facebook.com/v23.0/${pixelId}/events`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await (options.fetch || fetch)(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], access_token: token }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Meta CAPI HTTP ${res.status}`);
    const response = await res.json();
    if (!Number(response.events_received)) throw new Error("Meta did not confirm the event");
    return { sent: true };
  } finally { clearTimeout(timeout); }
}
