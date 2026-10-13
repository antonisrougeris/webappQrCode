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
  assert.match(ts, /descriptionBlock\.classList\.toggle\("is-expanded"\)/);
  assert.match(ts, /setText\(document\.getElementById\("pdpBreadcrumbProduct"\), product\.title\)/);
});

test("purchase controls remain the original working variant/cart controls", () => {
  for (const id of ["qrDestination", "variantControls", "sizeOptions", "productStock", "productColorOptions", "quantityValue", "productAddToCartBtn"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(css, /\.product-page \.add-to-cart-btn \{/);
  assert.match(ts, /setupMobileProductPurchase\(addBtn\)/);
});
