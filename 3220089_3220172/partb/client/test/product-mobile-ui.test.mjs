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

test("reviews above real title; price, sale percent and euro savings alongside", () => {
  assert.match(css, /"rating rating"\s*"title\s+price"\s*"meta\s+price"/);
  assert.match(css, /#productTitle\s*\{\s*display: block !important/);
  assert.match(css, /\.product-price-area\s*\{\s*display: flex !important/);
  assert.match(html, /id="mobilePriceSavings"/);
  assert.match(html, /id="mobileDiscountPercent"/);
  assert.match(html, /id="mobileSaveAmount"/);
  assert.match(ts, /mobileSavings.hidden = !onSale/);
  assert.match(ts, /formatPrice\(amountSaved\)/);
  assert.match(css, /#productSaleBadge\s*\{\s*display: none !important/);
});

test("desktop stays unchanged, original mobile size chips remain hidden", () => {
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(min-width: 601px\)/);
  assert.match(css, /#sizeOptions,[\s\S]*?#productStock\s*\{\s*display: none !important/);
  assert.match(css, /\.mobile-gallery-size-guide,[\s\S]*?\.mobile-price-savings \{ display: none !important/);
});
