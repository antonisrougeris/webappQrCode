import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const pdp=readFileSync("src/pages/product-details/product-details.html","utf8");
const desktop=readFileSync("public/assets/css/product-desktop-premium.css","utf8");
const cart=readFileSync("src/pages/cart/cart.ts","utf8");
const checkout=readFileSync("src/pages/checkout/checkout.ts","utf8");
const styles=readFileSync("src/pages/cart/cart-enhancements.css","utf8");
test("Product information retains native disclosure and exact SVG icons",()=>{
 assert.match(pdp,/class="icon icon-picto-document"/);
 assert.match(pdp,/class="icon icon-chevron-bottom-small"/);
 assert.match(pdp,/viewBox="0 0 8 6"/);
 assert.match(pdp,/<details class="product-description-block pdp-product-information"/);
});
test("desktop purchase order and mobile preservation",()=>{
 assert.match(desktop,/\.pdp-eco-highlights \{ order: 5;/);
 assert.match(desktop,/#productColorRow \{\s*order: 6;/);
 assert.match(desktop,/\.pdp-product-information \{ order: 7;/);
 assert.match(desktop,/\.qr-box \{ order: 8;/);
 assert.match(desktop,/\.size-row \{ order: 9;/);
 assert.match(desktop,/\.product-purchase-row \{ order: 11;/);
 assert.match(desktop,/\.delivery-info \{ order: 12;/);
 assert.match(desktop,/\.add-to-cart-btn \{ order: 13;/);
 assert.match(desktop,/@media \(min-width: 821px\)/);
 assert.match(desktop,/\.variant-controls\[hidden\] \{display:none!important;\}/);
});
test("cart and checkout link real products using locale aware paths",()=>{
 assert.match(cart,/productPath\(item\.slug \|\| getCartItemProductId\(item\)\)/);
 assert.match(cart,/class="cart-product-link cart-product-link--image"/);
 assert.match(cart,/class="cart-product-link" href="\$\{href\}"/);
 assert.match(checkout,/productPath\(item\.slug \|\| item\.productId\)/);
 assert.match(checkout,/class="checkout-product-link" href="\$\{href\}"/);
 assert.match(checkout,/class="checkout-product-link" href="\$\{rewardHref\}"/);
});
test("free keychain retains zero-price and original retail price comparison",()=>{
 assert.match(cart,/formatPrice\(Number\(rewardItem\.originalPrice \|\| 0\)\)/);
 assert.match(checkout,/const originalPrice = Number\(eligibleKeychain\.originalPrice \|\| 0\)/);
 assert.match(styles,/\.free-keychain-cart-reward__pricing del/);
 assert.match(styles,/\.checkout-reward-pricing del/);
});
