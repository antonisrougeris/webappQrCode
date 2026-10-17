import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const home = readFileSync("index.html","utf8");
const main = readFileSync("src/main.ts","utf8");
const toast = readFileSync("src/components/offerToast.ts","utf8");
const shop = readFileSync("src/pages/products/products.ts","utf8");
const product = readFileSync("src/pages/product-details/product-details.ts","utf8");
test("old launch popup and countdown are removed from homepage",()=>{
  assert.doesNotMatch(home,/comingSoonBar|promoOverlay|promoCode|countdownTimer/);
  assert.doesNotMatch(main,/initCountdown|initPromoPopup|SKAN10/);
});
test("promotion is delayed 40 seconds, limited by session, and dismissible",()=>{
  assert.match(toast,/OFFER_DELAY_MS = 40_000/);
  assert.match(toast,/sessionStorage\.setItem/);
  assert.match(toast,/offer-toast__close/);
  assert.match(toast,/visibilityState !== "visible"/);
  assert.match(toast,/\.cookie-banner/);
  assert.match(toast,/navigator\.clipboard\.writeText\(OFFER_CODE\)/);
});
test("coupon matches store checkout and all browsing pages share toast",()=>{
  assert.match(toast,/OFFER_CODE = "SKANARE10"/);
  assert.match(main,/initOfferToast\(\)/);
  assert.match(shop,/initOfferToast\(\)/);
  assert.match(product,/initOfferToast\(\)/);
});
