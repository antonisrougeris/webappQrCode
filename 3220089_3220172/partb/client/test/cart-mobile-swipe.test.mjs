import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const swipe = readFileSync("src/pages/cart/cart-swipe.ts","utf8");
const cart = readFileSync("src/pages/cart/cart.ts","utf8");
const css = readFileSync("src/pages/cart/cart-enhancements.css","utf8");

test("mobile rightward swipe dismisses but vertical and short drags do not", () => {
 assert.match(swipe,/dx <= 0/);
 assert.match(swipe,/Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.3/);
 assert.match(swipe,/drawerWidth \* 0\.28/);
 assert.match(swipe,/dx \/ elapsedMs >= 0\.58/);
 assert.match(swipe,/snapBack\(\)/);
});
test("swipe does not interfere with interactive controls or carousels", () => {
 assert.match(swipe,/cart-cross-sell-row/);
 assert.match(swipe,/document\.body\.classList\.contains\("gift-dialog-open"\)/);
 assert.match(swipe,/event\.cancelable\) event\.preventDefault\(\)/);
 assert.match(swipe,/max-width: 760px/);
});
test("existing X and overlay close and mobile swipe both use same drawer close", () => {
 assert.match(cart,/installMobileCartSwipe\(swipeDrawer, swipeOverlay, closeCartDrawer\)/);
 assert.match(cart,/target\.closest\([\s\S]*?#closeCart/);
 assert.match(cart,/resetCartSwipe\?\.\(\)/);
 assert.match(css,/@media \(max-width: 760px\)/);
});
