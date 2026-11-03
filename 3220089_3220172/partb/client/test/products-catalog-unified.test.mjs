import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const listing = readFileSync("src/pages/products/products.ts","utf8");
const shared = readFileSync("src/components/renderProducts.ts","utf8");
const css = readFileSync("public/assets/css/components.css","utf8");

test("catalog uses homepage renderer after API and on search/filter",()=>{
 assert.match(listing,/import \{ renderProducts \} from "\.\.\/\.\.\/components\/renderProducts"/);
 assert.match(listing,/renderProducts\(grid, filtered, \{ eagerFirstImages: 4 \}\)/);
 assert.doesNotMatch(listing,/meta\.textContent = product\.shortDescription/);
 assert.doesNotMatch(listing,/article\.className = `card product-card/);
});
test("shared cards show stock indicators and no descriptions",()=>{
 assert.match(shared,/product-stock/);
 assert.match(shared,/is-in-stock/);
 assert.match(shared,/is-out-of-stock/);
 assert.doesNotMatch(shared,/shortDescription/);
 assert.match(css,/\.products-shop \.product-card \.product-stock\.is-in-stock/);
});
test("catalog keeps category and query URL filtering",()=>{
 assert.match(listing,/params\.delete\("category"\)/);
 assert.match(listing,/params\.set\("category", state\.category\)/);
 assert.match(listing,/searchInput\?\.addEventListener\("input", update\)/);
 assert.match(listing,/categorySelect\?\.addEventListener\("change", update\)/);
});


test("homepage product collections share the catalog's card geometry and responsive grids", () => {
  const home = readFileSync("index.html", "utf8");
  for (const section of ["tshirts", "accessories"]) {
    assert.match(home, new RegExp('id="' + section + '" class="section[^"]* home-catalog-section"'));
  }
  for (const grid of ["featuredTshirtsGrid", "featuredAccessoriesGrid"]) {
    assert.match(home, new RegExp('id="' + grid + '"\\s+class="grid grid-4 products-grid"'));
  }
  assert.match(home, /components\.css\?v=20261103-home-catalog-parity/);
  const homeCss = css.slice(css.indexOf("/* Homepage product sections mirror the catalog card layout"));
  assert.match(homeCss, /\.home-catalog-section > \.container \{ width: min\(1440px, calc\(100% - 72px\)\)/);
  assert.match(homeCss, /\.home-catalog-section \.products-grid \{ grid-template-columns:repeat\(4,minmax\(0,1fr\)\); gap:32px 20px;/);
  assert.match(homeCss, /\.home-catalog-section \.product-media > img\.product-image \{[\s\S]*?object-fit: cover;/);
  assert.match(homeCss, /\.home-catalog-section \.product-card \.product-title \{[\s\S]*?font-size: clamp\(12px, \.95vw, 14px\)/);
  assert.match(homeCss, /\.home-catalog-section \.product-card-price \{ gap: 4px 7px; \}/);
  assert.match(homeCss, /@media \(max-width: 900px\) \{[\s\S]*?\.home-catalog-section \.products-grid \{ grid-template-columns: repeat\(2, minmax\(0,1fr\)\)/);
  assert.match(homeCss, /@media \(max-width: 600px\) \{[\s\S]*?\.home-catalog-section \.product-body \{ padding: 10px 1px 0; \}/);
  assert.match(home, /id="featuredTshirtsGrid"[\s\S]*?data-category="tshirt"[\s\S]*?data-limit="4"/);
  assert.match(home, /id="featuredAccessoriesGrid"[\s\S]*?data-category="accessory"[\s\S]*?data-limit="4"/);
});


test("mobile home cards are single column but shop cards stay two columns", () => {
  const mobile = css.slice(css.indexOf("/* Mobile storefront: full-width homepage cards"));
  assert.ok(mobile.length > 300);
  assert.match(mobile, /@media \(max-width: 600px\)/);
  assert.match(mobile, /\.home-catalog-section \.products-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(mobile, /\.products-shop \.products-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(mobile, /grid-template-areas:\s*"title title"\s*"stock price"/);
  assert.match(mobile, /\.products-shop \.product-card \.product-row \{\s*display: contents;/);
  assert.match(mobile, /\.products-shop \.product-card \.product-title \{[\s\S]*?grid-area: title;[\s\S]*?width: 100%;/);
  assert.match(mobile, /\.products-shop \.product-card \.product-stock \{[\s\S]*?grid-area: stock;/);
  assert.match(mobile, /\.products-shop \.product-card \.product-card-price \{[\s\S]*?grid-area: price;/);
  assert.match(mobile, /\.products-shop \.product-card \.price \{[\s\S]*?font-size: 15px;/);
  assert.match(mobile, /\.home-catalog-section \.product-card \.price--sale \{\s*font-size: 16px;/);
});
test("mobile tapping is stable and rehydration swaps cards only after rendering", () => {
  const mobile = css.slice(css.indexOf("/* Mobile storefront: full-width homepage cards"));
  assert.match(mobile, /-webkit-tap-highlight-color: transparent;/);
  assert.match(mobile, /touch-action: manipulation;/);
  assert.match(mobile, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(shared, /document\.createDocumentFragment\(\)/);
  assert.match(shared, /fragment\.appendChild\(article\)/);
  assert.match(shared, /container\.replaceChildren\(fragment\)/);
  assert.doesNotMatch(shared, /container\.innerHTML = "";/);
});
