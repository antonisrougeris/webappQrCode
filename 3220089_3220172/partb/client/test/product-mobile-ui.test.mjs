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
  assert.match(css, /height: clamp\(310px, 54svh, 510px\)/);
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
  assert.match(css, /bottom: calc\(82px/);
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
