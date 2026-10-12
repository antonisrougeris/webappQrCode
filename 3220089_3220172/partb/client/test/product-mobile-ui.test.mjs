import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("src/pages/product-details/product-details.html", "utf8");
const css = readFileSync("public/assets/css/product-mobile-immersive.css", "utf8");
const ts = readFileSync("src/pages/product-details/product-details.ts", "utf8");

test("one mobile purchase row, custom stock-aware size picker and no duplicated price", () => {
  const bar = html.match(/<aside id="mobilePurchaseBar"[\s\S]+?<\/aside>/)?.[0];
  assert.ok(bar);
  for (const id of ["mobileSizeTrigger", "mobileSizeMenu", "mobileAddToCartBtn"]) {
    assert.match(bar, new RegExp("id=\"" + id + "\""));
  }
  assert.doesNotMatch(bar, /<select|mobileBarPrice|mobileBarTitle|↗/);
  assert.match(ts, /mainCartButton\.click\(\)/);
  assert.match(ts, /original\.click\(\)/);
});

test("shorter, clean gallery with real Size guide modal action", () => {
  assert.doesNotMatch(html, /id="mobileHeroTitle"|id="mobileHeroPrice"|mobile-product-hero__bottom/);
  assert.match(html, /id="mobileSizeGuideButton"[\s\S]*?Size guide/);
  assert.match(css, /height: clamp\(350px, 61svh, 580px\)/);
  assert.match(css, /\.product-main-image::after[\s\S]*?rgba\(0,0,0,\.29\), transparent 23%\)/);
  assert.match(ts, /mobileButton\?\.addEventListener\("click", open\)/);
});

test("sale pricing aligns current price with title and puts old price beside reviews", () => {
  assert.match(css, /"rating original"\s*"title price"\s*"meta price"/);
  assert.match(css, /#productTitle\s*\{\s*display: block !important/);
  assert.match(css, /\.product-price-area\s*\{\s*display: flex !important/);
  assert.match(html, /id="mobileReviewOldPrice"/);
  assert.match(ts, /reviewOldPrice.hidden = !onSale/);
  assert.match(ts, /priceEl\?\.classList.toggle\("is-discounted", onSale\)/);
  assert.match(css, /#productPrice\.is-discounted \.product-price__current/);
  assert.doesNotMatch(html, /mobileDiscountPercent|mobilePriceSavings|mobileSaveAmount/);
  assert.match(html, /id="mobileGalleryBadge"/);
  assert.match(html, /id="mobileGallerySave"/);
});

test("desktop gallery remains intact and mobile size chips stay hidden", () => {
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(min-width: 601px\)/);
  assert.match(css, /#sizeOptions,[\s\S]*?#productStock\s*\{\s*display: none !important/);
  assert.match(css, /\.mobile-gallery-size-guide,[\s\S]*?\.mobile-price-savings,[\s\S]*?\.mobile-review-old-price \{ display: none !important/);
});

test("purchase renders before reviews and related product requests", () => {
  const bind = ts.indexOf("setupMobileProductPurchase(addBtn)");
  const handle = ts.indexOf('addBtn.addEventListener("click", async () =>');
  const loadReviews = ts.lastIndexOf("const reviews = await getProductReviews(product.id)");
  const recommendations = ts.indexOf("void renderRelatedProducts(product)");
  assert.ok(bind >= 0 && handle > bind);
  assert.ok(loadReviews > handle);
  assert.ok(recommendations > handle);
  assert.match(html, /class="mobile-purchase-bar is-loading"/);
  assert.match(ts, /bar.classList.remove\("is-loading"\)/);
});
test("color preview uses colorOptions first picture, retains fallback", () => {
  assert.match(ts, /const cover = option\?\.images\?\.\[0\]/);
  assert.match(ts, /product-color-swatch__preview/);
  assert.match(ts, /product-color-swatch__dot/);
  assert.match(css, /grid-area: quantity/);
});
test("Crisp widget is raised for mobile product pages only", () => {
  assert.match(css, /body:has\(\.product-page\) #crisp-chatbox/);
  assert.match(css, /bottom: calc\(185px/);
});

test("product page removes unwanted guarantee and duplicate accordions everywhere", () => {
  assert.doesNotMatch(html, /QR guarantee|Active QR guaranteed/);
  assert.doesNotMatch(html, /class="product-extra-info"|<summary>\s*Product details|<summary>\s*Shipping & returns/);
  assert.match(html, /Free shipping/);
  assert.match(html, /Easy returns/);
});
test("desktop and mobile both use compact color photo swatches", () => {
  const firstMedia = css.indexOf("@media (max-width: 600px)");
  const sharedRules = css.slice(0, firstMedia);
  assert.match(sharedRules, /#productColorOptions \.product-color-swatch__preview/);
  assert.match(sharedRules, /max-width: 82px/);
  assert.match(sharedRules, /object-fit: cover/);
  assert.doesNotMatch(css, /\/\* Color images come from colorOptions/);
});
test("mobile subtitle follows H1 and price is aligned to the edge", () => {
  assert.match(css, /"title price"\s*"meta price"/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) max-content/);
  assert.match(css, /padding: 16px 12px 24px 14px !important/);
  assert.match(css, /margin: 2px 0 10px/);
});
test("the product page alone uses euro-first price formatting", () => {
  assert.match(ts, /function formatProductPrice\(value: number\)/);
  assert.match(ts, /formatProductPrice\(product\.price\)/);
  assert.match(ts, /formatProductPrice\(originalPrice\)/);
  assert.match(ts, /reviewOldPrice\.textContent = onSale \? formatProductPrice/);
  assert.match(ts, /function formatPrice\(value: number\)/);
});

test("mobile variant section has no duplicate rules and the color label starts on the left", () => {
  assert.match(css, /\.product-info \.variant-controls \{\s*grid-area: variants;[\s\S]*?padding-top: 0;\s*border-top: 0;/);
  assert.match(css, /#productColorRow \{\s*width: 100%;\s*margin: 0;\s*padding: 0;\s*border: 0;/);
  assert.match(css, /#productColorRow \.product-color-row__heading \{\s*display: block !important;/);
});

test("mobile delivery promise sits above Size / Add to cart, without duplicating it in-page", () => {
  const bar = html.match(/<aside id="mobilePurchaseBar"[\s\S]+?<\/aside>/)?.[0];
  assert.ok(bar);
  const delivery = bar.indexOf("mobile-purchase-bar__delivery");
  const controls = bar.indexOf("mobile-purchase-bar__controls");
  assert.ok(delivery >= 0 && controls > delivery);
  assert.match(bar, /At your door in <strong>2–5 business days<\/strong>/);
  assert.match(css, /\.product-info \.delivery-info \{ display: none !important; \}/);
  assert.match(css, /\.mobile-purchase-bar__delivery \{\s*box-sizing: border-box;\s*display: flex;/);
  assert.match(css, /padding: 0 0 calc\(130px/);
});

test("delivery text stays aligned only with the Add to cart column", () => {
  assert.match(css, /width: calc\(100% - 103px\)/);
  assert.match(css, /margin: 0 0 7px 103px/);
  assert.match(css, /:has\(\.mobile-purchase-bar__size\[hidden\]\) \.mobile-purchase-bar__delivery/);
  assert.match(css, /white-space: normal/);
});
test("color label is block-aligned to the left rather than column-flex centered", () => {
  assert.match(css, /#productColorRow \.product-color-row__heading \{\s*display: block !important;/);
  assert.match(css, /#productColorRow \.product-color-row__heading > span \{\s*display: block;/);
  assert.match(css, /text-align: left !important;/);
});
test("Crisp has extra height clearance only on mobile product pages", () => {
  assert.match(css, /body:has\(\.product-page\) \.crisp-client \.cc-tlyw:not/);
  assert.match(css, /bottom: calc\(185px \+ env\(safe-area-inset-bottom/);
});


test("cart-first size selection adds exactly once while manual size selection does not", () => {
  const addMobile = ts.indexOf("function setupMobileProductPurchase(");
  const rest = ts.slice(addMobile, ts.indexOf("async function initProductDetailsPage", addMobile));
  assert.match(rest, /let addOnSizeSelection = false;/);
  assert.match(rest, /addOnSizeSelection = true;\s*openSizeMenu\(\);/);
  assert.match(rest, /const shouldAddToCart = addOnSizeSelection;\s*original\.click\(\);/);
  assert.match(rest, /if \(shouldAddToCart && selectedSize\(\) === option\.dataset\.mobileSize && !mainCartButton\.disabled\) \{\s*mainCartButton\.click\(\);/);
  assert.match(rest, /function closeSizeMenu\([\s\S]*?addOnSizeSelection = false;/);
  assert.match(rest, /sizeTrigger\.addEventListener\("click", \(\) => \{\s*\/\/[^\\n]*\s*addOnSizeSelection = false;/);
  assert.equal((rest.match(/mainCartButton\.click\(\)/g) || []).length, 2);
});
test("mobile color heading remains invisible but reserves original swatch position", () => {
  assert.match(css, /#productColorRow \.product-color-row__heading \{[\s\S]*?visibility: hidden;/);
  assert.match(css, /margin: 0 0 9px !important;/);
  assert.match(css, /@media \(min-width: 601px\)/);
});
test("mobile trust benefits render as two balanced cards, desktop unchanged", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 600px)"), css.indexOf("@media (min-width: 601px)"));
  assert.match(mobile, /\.product-info \.product-benefits \{\s*grid-area: benefits;\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /\.product-info \.product-benefit \{[\s\S]*?border-radius: 12px;/);
  assert.match(mobile, /\.product-info \.product-benefit strong \{[\s\S]*?font-size: 11px;/);
});
