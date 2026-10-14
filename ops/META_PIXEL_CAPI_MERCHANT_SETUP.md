# SKANARE — Meta Pixel, Conversions API and Merchant Center setup

## Single cookie banner

The existing Skanare banner remains the only consent dialog. **Accept** enables both optional Google Analytics and Meta marketing; **Reject** disables both; **Customize** expands inline controls for separate choices. Existing `skanare_cookie_consent` values were collected before Meta was mentioned and cannot silently authorize marketing: the new versioned key `skanare_cookie_consent_v2` causes one fresh prompt after deployment.

Consent is editable at `https://skanare.com/cookie-policy` using **Change cookie preferences**. The privacy and cookie policy pages describe the Google and Meta uses. This is a technical implementation; seek legal/CMP advice for EEA consent, withdrawals, recordkeeping and compliance.

## Meta setup — requires merchant account action

1. In Meta Business Suite / Events Manager, create or open a dataset/pixel for **Skanare**. Select **Meta Pixel** and record the **Pixel ID** (numeric). You do not need to launch an ad campaign.
2. Configure frontend BUILD variable **`VITE_META_PIXEL_ID`** as a GitHub Actions repository variable. The value must reach `npm run build` in the Frontend Build workflow and the production release build. This is NOT a secret.
3. In Events Manager → dataset → Settings → Conversions API → Generate access token; keep **`META_CAPI_ACCESS_TOKEN`** private. Configure the backend runtime `/srv/skanare/shared/server.env` (or the current server.env used by PM2) with:
   - `META_PIXEL_ID=<same numeric ID>`
   - `META_CAPI_ACCESS_TOKEN=<private token>`
   Restart the backend securely through the normal deployment/PM2 flow. Never paste the token in chat, GitHub, frontend variables or screenshots.
4. Only **after** both sides are configured, use Events Manager → Test Events and the Meta Pixel Helper extension. Accept marketing cookies, then inspect:
   - PageView on loading any page
   - ViewContent on a product
   - AddToCart after successful cart POST
   - InitiateCheckout after checkout loads
   - Purchase from the browser only after a verified Viva payment
   - Purchase from the **server** only when marketing consent was saved at checkout and Viva verified paid
5. Meta browser/server purchases share `event_id = skanare_purchase_<order document ID>` for deduplication. Variant content IDs are `<productId>::<sku>` to match the catalog feed (ViewContent uses group ID).

**Limitations:** Meta browser conversion may be blocked by browser plugins. Server CAPI does not send old/historic orders. If CAPI fails after webhook, failure is logged without making Viva retry; a separate retry/monitoring job could be added for additional resilience. Hashing email before sending it to Meta does not make the data anonymous. Existing website visitors must explicitly accept the updated consent banner. Refunds/cancelations are not auto-reconciled with Meta in this first iteration.

## Merchant Center setup — no paid Google Ads campaign needed

1. Create or open **Google Merchant Center** at https://merchants.google.com/ and use **skanare.com** as the online store. Verify and claim the domain through Google's supported method.
2. Add business information, customer service details, shipping for Greece, return policy and accurate business details.
3. Products → Add products → data source / scheduled fetch. Use **https://skanare.com/api/merchant/feed.xml** after deployment. Select country **Greece**, language **English** (the feed language), currency **EUR**. Choose an automatic fetch cadence suitable for stock changes.
4. Feed is read-only, public, XML/RSS 2.0. It uses live Firestore products with SKU-level variants and `item_group_id`, available stock, regular/sale price, product image, brand Skanare, condition new and clothing attributes for T-shirts.
5. In Merchant Center → Products → Needs attention, resolve any missing-attribute or policy issues (GTIN/MPN and availability especially). Confirm every feed image/price/stock agrees with its website landing page, including variation selection and sale prices.
6. Google may require more details on material, shipping/returns or other apparel attributes; use product data and Merchant Center diagnostics rather than inventing.
7. The feed has no campaign, cannot spend money, and does not auto-enable Google Ads.

## Deploy and validation

- Merge PR only after **Frontend Build**, backend tests, Security Audit, and CodeQL pass.
- Production is only confirmed once the deployment workflow runs successfully, the public feed URL responds, and Meta Test Events confirms real events.
- The Meta Pixel and CAPI are **inactive by design** until the respective credentials are configured.
- Do NOT test Purchase with a fake success-page URL; use a confirmed Viva test/real payment and audit that the order status is actually `paid`.
