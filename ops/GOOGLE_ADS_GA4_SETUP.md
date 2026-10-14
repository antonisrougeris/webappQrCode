# SKANARE: GA4 purchases → Google Ads

## Implemented in the storefront

- Consent-gated `page_view`, `view_item`, `add_to_cart`, and `begin_checkout`.
- After Viva return, the authenticated order API is polled and a `purchase` is sent **only** for an order whose backend status is `paid`, with backend Viva `transactionId` and `paidAt`.
- `purchase.transaction_id` is the stable order document ID for deduplication. Each browser also stores a per-order deduplication marker **only after** the GA4 event is queued.
- `currency`, discounted merchandise `value` (excluding shipping), `shipping`, optional `coupon`, and `items` with item ID/name, price, quantity and variant are populated using backend order data.
- No tracking when analytics cookies are rejected; if accepted while viewing the confirmed success page, the event is retried.
- No backfill is attempted for historic paid orders.

**Limitations:** Browser purchase tracking requires the buyer to return to the confirmation page and allow analytics. Browser blockers/network failures can prevent delivery. The local marker is not proof GA4 received an event. GA4 transaction_id helps deduplicate repeated sends. Full server-side tracking would additionally require a consent-aware, privacy-reviewed GA4 Measurement Protocol setup and client/session identifiers captured with user consent. Do **not** send all Viva webhooks unconditionally to GA4.

## Account setup required (not controlled by GitHub)

1. Sign in to the correct GA4 property for skanare.com and verify real purchase events in Realtime and DebugView (or test with a real paid order; do not manufacture a false purchase).
2. In GA4, Admin → Product links → Google Ads links → Link the correct Google Ads account. Confirm the required GA4 Editor and Google Ads Admin roles.
3. In Google Ads, enable auto-tagging.
4. Ensure `purchase` is configured as an Analytics **key event** (Admin → Data display → Events).
5. Google Ads → Goals → Conversions → New conversion action → Import → Google Analytics web key event `purchase` (or GA4 Advertising → Tools → Conversion management → New conversion).
6. Set the imported *purchase* conversion to **Primary** if it will control bidding, value from Analytics, **Every** purchase (not One), attribution/window per campaign strategy. If created from Analytics, Google Ads may default the action to **Secondary**.
7. Keep `view_item`, `add_to_cart`, `begin_checkout` as observation/secondary actions if added; do not count them as primary sales.
8. If a native Google Ads purchase tag is configured later, ensure it doesn't also count as an additional **Primary** purchase conversion for the same sale.
9. For verification use a real campaign-tagged visit (auto-tagging/GCLID) and a genuine paid order. Organic/direct test purchases should appear in GA4 but don't automatically become Google Ads-attributed conversions.
10. Connect Google Merchant Center separately for Shopping/product listing campaigns; a product feed and Merchant Center verification are **not** included in this PR.

**Manual verification:** Open DevTools → Network, filter `collect`, inspect event `en=purchase`; check `transaction_id`, `value`, and `currency`. In GA4 inspect the incoming purchase event, and later Ecommerce purchases/revenue reports. The DebugView may require debug_mode or Tag Assistant. Events and Google Ads conversions may need 24–48 hours for normal reports/import availability.

References:
- https://support.google.com/analytics/answer/9379420
- https://support.google.com/google-ads/answer/10632359
- https://support.google.com/google-ads/answer/9520128
