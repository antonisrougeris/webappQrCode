import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const badge=readFileSync("src/utils/cart-badge.ts","utf8");
const css=readFileSync("src/utils/cart-badge.css","utf8");
const cart=readFileSync("src/pages/cart/cart.ts","utf8");
test("badge attaches to existing header cart link without replacing SVG",()=>{
 assert.match(badge,/\.site-header \.cart-link/);
 assert.match(badge,/link\.appendChild\(badge\)/);
 assert.doesNotMatch(badge,/cartLink\.textContent\s*=/);
 assert.match(css,/background:\s*#111/);
 assert.doesNotMatch(css,/#ffc|yellow/i);
});
test("count sums paid units, not separate promotional keychain",()=>{
 assert.match(badge,/item\.isFreeReward/);
 assert.match(badge,/sum \+ \(Number\.isFinite\(quantity\)/);
 assert.match(badge,/badge\.hidden = count === 0/);
});
test("refreshes after mutations, auth and browser restoration",()=>{
 assert.match(cart,/updateCartBadgeFromCart\(/);
 assert.match(badge,/cart:change/);
 assert.match(badge,/cart:refresh/);
 assert.match(badge,/pageshow/);
 assert.match(badge,/onAuthStateChanged/);
 assert.match(badge,/requestRevision !== revision/);
});
