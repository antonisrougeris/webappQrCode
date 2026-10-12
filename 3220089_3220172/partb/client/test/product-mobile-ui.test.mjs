import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync("src/pages/product-details/product-details.html", "utf8");
const css = readFileSync("public/assets/css/product-mobile-immersive.css", "utf8");
const ts = readFileSync("src/pages/product-details/product-details.ts", "utf8");

test("mobile purchase bar has one action row without repeated product pricing", () => {
  const bar = html.match(/<aside id="mobilePurchaseBar"[\s\S]+?<\/aside>/)?.[0];
  assert.ok(bar);
  assert.match(bar, /id="mobileSizeTrigger"/);
  assert.match(bar, /id="mobileSizeMenu"/);
  assert.match(bar, /id="mobileAddToCartBtn"/);
  assert.doesNotMatch(bar, /<select|mobileBarPrice|mobileBarTitle|↗/);
  assert.equal((bar.match(/data-mobile-buy-label/g) || []).length, 1);
});
test("mobile CSS shows hero pricing just once and hides original visible size chips", () => {
  assert.match(html, /<h1 id="mobileHeroTitle"/);
  assert.match(css, /#productTitle,[\s\S]*?#productMeta,[\s\S]*?\.product-price-area\s*\{\s*display:\s*none/);
  assert.match(css, /#sizeOptions,[\s\S]*?#productStock\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(min-width: 601px\)/);
});
test("custom sizes select the real product variant and cart handler", () => {
  assert.match(ts, /original\.click\(\)/);
  assert.match(ts, /mainCartButton\.click\(\)/);
  assert.match(ts, /if \(!sizeWrap\.hidden && !selectedSize\(\)\)/);
  assert.match(ts, /new MutationObserver\(syncSizeOptions\)/);
});
