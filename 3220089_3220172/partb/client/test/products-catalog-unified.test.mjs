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
 assert.match(shared,/class="product-stock/);
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
