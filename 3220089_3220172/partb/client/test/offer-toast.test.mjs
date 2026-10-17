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
test("promotion is delayed 30 seconds, limited by session, and dismissible",()=>{
  assert.match(toast,/OFFER_DELAY_MS = 30_000/);
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

test("offer appears top left with visible 15-to-0 deadline counter",()=>{
  const css=readFileSync("src/components/offerToast.css","utf8");
  assert.match(css,/\.offer-toast\{top:max\(/);
  assert.match(css,/bottom:auto/);
  assert.match(toast,/OFFER_VISIBLE_SECONDS = 15/);
  assert.match(toast,/class="offer-toast__timer"/);
  assert.match(toast,/Math\.ceil\(\(deadline - Date\.now\(\)\) \/ 1000\)/);
  assert.match(toast,/remaining === 0\) dismiss\(toast\)/);
  assert.match(toast,/window\.setInterval\(updateCountdown, 250\)/);
  assert.doesNotMatch(toast,/toast\.matches\(":hover"\)/);
});
test("copy shows confirmation for 1.1 seconds while failed copy remains actionable",()=>{
  assert.match(toast,/if \(copied\) \{[\s\S]*?button\.textContent = greek \? "Αντιγράφηκε ✓" : "Copied ✓"/);
  assert.match(toast,/window\.setTimeout\(\(\) => dismiss\(toast\), 1100\)/);
  assert.match(toast,/window\.clearInterval\(countdownTimer\)/);
  assert.match(toast,/button\.disabled = false/);
  assert.match(toast,/window\.clearInterval\(countdownTimer\)/);
});
