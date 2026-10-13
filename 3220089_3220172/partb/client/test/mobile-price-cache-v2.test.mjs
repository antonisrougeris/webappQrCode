import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync("src/pages/product-details/product-details.html","utf8");
const css=readFileSync("public/assets/css/product-mobile-android-price-v2-20261013.css","utf8");
test("new unique mobile CSS is loaded last, after desktop and old mobile CSS",()=>{
 const marker="product-mobile-android-price-v2-20261013.css";
 assert.ok(html.indexOf(marker)>html.indexOf("product-desktop-premium.css"));
 assert.ok(html.indexOf(marker)>html.indexOf("product-mobile-immersive.css"));
});
test("price and tax return to the right of title, subtitle retains left column",()=>{
 assert.match(css,/"title price"\s*"meta price"/);
 assert.match(css,/\.product-price-area \{[\s\S]*?grid-area: price;/);
 assert.match(css,/\.tax-note \{[\s\S]*?white-space: nowrap;/);
 assert.match(css,/word-break: normal;/);
});
test("only compact green badges appear on mobile, desktop remains unchanged",()=>{
 assert.match(css,/#pdpEcoHighlights \.pdp-eco-full \{\s*display: none !important/);
 assert.match(css,/#pdpEcoHighlights \.pdp-eco-compact \{\s*display: inline-flex !important/);
 assert.match(css,/white-space: nowrap;/);
});
