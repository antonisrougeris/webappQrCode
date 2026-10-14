import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { renderMerchantXml, productToMerchantEntries } from "../src/services/merchant-feed.service.js";
import { buildMetaPurchase, sendMetaPurchaseForPaidOrder } from "../src/services/meta-conversions.service.js";

const products = [{
  id: "tee-001", slug: "qr-tee", title: "Interactive QR Tee",
  description: "Scan to connect", category: "tshirt", active: true,
  image: "https://skanare.com/assets/tee.webp", price: 20, originalPrice: 20,
  discountPercent: 10,
  colorOptions: [{ name: "Black", images: ["https://skanare.com/assets/black.webp"] }],
  variants: [
    { sku: "TEE-BLK-M", size: "M", color: "Black", stock: 3, price: 20 },
    { sku: "TEE-BLK-L", size: "L", color: "Black", stock: 0, price: 20 }
  ]
}];
const paidOrder = {
  id: "order123", paymentStatus: "paid",
  marketingConsent: { granted: true, version: 2 },
  payment: { transactionId: "viva123" },
  customer: { email: "User@Example.com" },
  subtotal: 36, total: 38, shippingCost: 2,
  items: [{ productId: "tee-001", title: "Interactive QR Tee", unitPrice: 20, quantity: 2,
    variant: { sku: "TEE-BLK-M", size: "M", color: "Black" } }]
};

test("merchant XML includes SKU-level variants, stock, sales and escaped values", () => {
  const variants = productToMerchantEntries(products[0]);
  assert.equal(variants.length, 2);
  assert.equal(variants[0].id, "tee-001::TEE-BLK-M");
  const xml = renderMerchantXml(products);
  assert.match(xml, /<g:item_group_id>tee-001<\/g:item_group_id>/);
  assert.match(xml, /<g:id>tee-001::TEE-BLK-M<\/g:id>/);
  assert.match(xml, /<g:availability>in_stock<\/g:availability>/);
  assert.match(xml, /<g:availability>out_of_stock<\/g:availability>/);
  assert.match(xml, /<g:price>20.00 EUR<\/g:price>/);
  assert.match(xml, /<g:sale_price>18.00 EUR<\/g:sale_price>/);
  assert.match(xml, /<g:gender>unisex<\/g:gender>/);
  assert.match(xml, /https:\/\/skanare.com\/product\/qr-tee/);
  assert.ok(!xml.includes("access_token"));
});

test("no catalog entry without real HTTPS product image", () => {
  const xml = renderMerchantXml([{ ...products[0], image: "", images: [], colorOptions: [] }]);
  assert.doesNotMatch(xml, /<item>/);
});

test("Meta server never creates a purchase without verified Viva payment and checkout marketing opt-in", () => {
  for (const bad of [
    { ...paidOrder, paymentStatus: "pending" },
    { ...paidOrder, marketingConsent: { granted: false } },
    { ...paidOrder, marketingConsent: undefined },
    { ...paidOrder, payment: { transactionId: "" } }
  ]) assert.equal(buildMetaPurchase(bad), null);
});

test("Meta CAPI payload contains stable event ID, hashed email and catalog-matching variant IDs", () => {
  const event = buildMetaPurchase(paidOrder, 1781430000);
  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, "skanare_purchase_order123");
  assert.equal(event.event_time, 1781430000);
  assert.equal(event.custom_data.value, 36);
  assert.deepEqual(event.custom_data.content_ids, ["tee-001::TEE-BLK-M"]);
  assert.deepEqual(event.user_data.em, [
    crypto.createHash("sha256").update("user@example.com").digest("hex")
  ]);
  assert.ok(!JSON.stringify(event).includes("User@Example.com"));
});

test("Meta request is sent ONLY if configured and opted in, without exposing token in URL", async () => {
  const oldPixel = process.env.META_PIXEL_ID;
  const oldToken = process.env.META_CAPI_ACCESS_TOKEN;
  try {
    process.env.META_PIXEL_ID = "12345678912345";
    process.env.META_CAPI_ACCESS_TOKEN = "secret-test";
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ events_received: 1 }) };
    };
    assert.equal((await sendMetaPurchaseForPaidOrder({ ...paidOrder, marketingConsent: { granted: false } }, { fetch: fetchFn })).sent, false);
    assert.equal(calls.length, 0);
    assert.equal((await sendMetaPurchaseForPaidOrder(paidOrder, { fetch: fetchFn })).sent, true);
    assert.equal(calls.length, 1);
    assert.ok(!calls[0].url.includes("secret-test"));
    assert.equal(JSON.parse(calls[0].init.body).data[0].event_id, "skanare_purchase_order123");
  } finally {
    if (oldPixel === undefined) delete process.env.META_PIXEL_ID; else process.env.META_PIXEL_ID = oldPixel;
    if (oldToken === undefined) delete process.env.META_CAPI_ACCESS_TOKEN; else process.env.META_CAPI_ACCESS_TOKEN = oldToken;
  }
});
