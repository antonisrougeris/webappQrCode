import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pdp = readFileSync("public/assets/css/product-desktop-premium.css","utf8");
const catalog = readFileSync("public/assets/css/components.css","utf8");
const productHtml = readFileSync("src/pages/product-details/product-details.html","utf8");
const productsHtml = readFileSync("src/pages/products/products.html","utf8");
const productJs = readFileSync("src/pages/product-details/product-details.ts","utf8");

test("desktop-only PDP suppresses excessive rules and keeps purchase logic", () => {
  assert.match(pdp,/\.product-info #productColorRow\s*\{\s*border:\s*0;/);
  assert.match(pdp,/\.product-info \.product-price-area\s*\{ border-bottom: 0;/);
  assert.match(pdp,/\.pdp-product-information\s*\{\s*border: 0;/);
  assert.match(productHtml,/id="productAddToCartBtn"/);
  assert.match(productHtml,/id="productColorOptions"/);
  assert.match(productHtml,/<details class="product-description-block pdp-product-information"/);
});

test("gallery thumbnails use full resolution product images and do not fade", () => {
  assert.match(productJs,/getColorImages\(confirmedProduct, color\)/);
  assert.match(productJs,/data-src="\$\{safeProductText\(src\)\}"/);
  assert.match(pdp,/\.product-page \.product-thumbnail img\s*\{[\s\S]*?object-fit:contain;/);
  assert.match(pdp,/\.product-page \.product-thumbnail\s*\{[\s\S]*?opacity: 1;/);
});

test("desktop catalog fills the page with contained uncropped artwork", () => {
  assert.match(catalog,/\.products-shop > \.container \{ width: min\(1440px/);
  assert.match(catalog,/\.products-shop \.products-grid \{ grid-template-columns:repeat\(4/);
  assert.match(catalog,/\.products-shop \.product-media > img\.product-img\s*\{[\s\S]*?object-fit:contain;/);
  assert.match(productsHtml,/components\.css\?v=20261013-catalog-clarity/);
});
