import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("src/pages/product-details/product-details.html", "utf8");
const css = readFileSync("public/assets/css/product-desktop-premium.css", "utf8");
const ts = readFileSync("src/pages/product-details/product-details.ts", "utf8");
const mobile = readFileSync("public/assets/css/product-mobile-immersive.css", "utf8");

test("desktop redesign is isolated above the existing mobile breakpoint", () => {
  assert.match(css, /@media \(min-width: 821px\)/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /pdp-desktop-breadcrumb,[\s\S]*?pdp-desktop-help-links \{ display: none !important; \}/);
  assert.match(html, /product-desktop-premium\.css/);
  assert.match(mobile, /height: clamp\(350px, 61svh, 580px\)/);
});

test("gallery uses one existing image, thumbnails and navigation", () => {
  for (const id of ["productImageStage", "productImage", "productThumbnails", "productImagePrev", "productImageNext"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(css, /grid-template-columns: 72px minmax\(0, 1fr\)/);
  assert.match(css, /\.product-page \.product-gallery \{/);
  assert.match(ts, /function renderProductThumbnails\(\)/);
});

test("desktop includes real product breadcrumbs and an expandable description", () => {
  for (const id of ["pdpBreadcrumbCategory", "pdpBreadcrumbProduct", "desktopProductDescriptionBlock"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /<details class="product-description-block pdp-product-information"/);
  assert.match(ts, /setText\(document\.getElementById\("pdpBreadcrumbProduct"\), product\.title\)/);
});

test("purchase controls remain the original working variant/cart controls", () => {
  for (const id of ["qrDestination", "variantControls", "sizeOptions", "productStock", "productColorOptions", "quantityValue", "productAddToCartBtn"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(css, /\.product-page \.add-to-cart-btn \{/);
  assert.match(ts, /setupMobileProductPurchase\(addBtn\)/);
});


test("desktop title and price share the heading row and keep purchase ordering", () => {
  const desktop = css.slice(css.indexOf("/* Desktop PDP: keep the price beside"));
  assert.match(desktop, /@media \(min-width: 821px\)/);
  assert.match(desktop, /"title price"/);
  assert.match(desktop, /"meta price"/);
  assert.match(desktop, /"rating price"/);
  assert.match(desktop, /#productPrice \{[\s\S]*?flex-direction: column;/);
  assert.match(desktop, /#productPrice \{[\s\S]*?align-items: flex-end;/);
  assert.match(desktop, /#productPrice \.product-price__old \{[\s\S]*?font-size: 13px;/);
  assert.match(desktop, /#productPrice \.product-price__current \{[\s\S]*?font-size: 30px;/);
  assert.match(desktop, /\.product-price-area:has\(#productPrice\.is-discounted\) \{[\s\S]*?margin-top: -7px;/);
  assert.match(desktop, /\.product-price-area \{[\s\S]*?margin: 9px 0 0;/);
  assert.match(desktop, /\.tax-note \{[\s\S]*?text-align: right;/);
  assert.match(desktop, /"information information"[\s\S]*?"qr qr"[\s\S]*?"size size"[\s\S]*?"stock stock"[\s\S]*?"quantity quantity"[\s\S]*?"delivery delivery"[\s\S]*?"cart cart"/);
  assert.match(html, /compact-pills-single-row/);
});


test("product highlights use brief copy and remain side by side on desktop", () => {
  const pills = html.match(/<div class="pdp-eco-highlights"[^>]*>[\s\S]*?<\/div>/)?.[0];
  assert.ok(pills);
  assert.match(pills, /class="pdp-eco-full">100% Cotton<\/span>/);
  assert.match(pills, /class="pdp-eco-full">Quality Print · Made in Greece<\/span>/);
  assert.match(pills, /class="pdp-eco-compact">100% Cotton<\/span>/);
  assert.match(pills, /class="pdp-eco-compact">Quality Print · Made in Greece<\/span>/);
  assert.doesNotMatch(pills, /Premium 190 GSM Fabric|Made with love in Greece/);

  const desktop = css.slice(css.indexOf("/* Compact T-shirt highlights:"));
  assert.match(desktop, /@media \(min-width: 601px\)/);
  assert.match(desktop, /#pdpEcoHighlights:not\(\[hidden\]\) \{[\s\S]*?flex-wrap: nowrap;/);
  assert.match(desktop, /#pdpEcoHighlights \.pdp-eco-full \{[\s\S]*?white-space: nowrap;/);
  assert.match(html, /compact-pills-single-row/);
});
