import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const cookie=readFileSync("src/components/cookieConsent.ts","utf8");
const consentCss=readFileSync("src/components/cookieConsent.css","utf8");
const mobile=readFileSync("public/assets/css/product-mobile-immersive.css","utf8");
const toast=readFileSync("src/utils/toast.ts","utf8");
const common=readFileSync("public/assets/css/components.css","utf8");
const cart=readFileSync("src/pages/cart/cart.ts","utf8");
test("consent remains actionable over mobile sticky purchase bar",()=>{
 assert.match(cookie,/import "\.\/cookieConsent\.css"/);
 assert.match(consentCss,/z-index: 2147483600 !important/);
 assert.match(consentCss,/pointer-events: auto/);
});
test("two garment features form one row just below mobile title and meta",()=>{
 assert.match(mobile,/"highlights highlights" "badges badges"/);
 assert.match(mobile,/grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.35fr\)/);
 assert.match(mobile,/white-space: nowrap/);
});
test("cart link reminder moves to header level for four seconds",()=>{
 assert.match(toast,/isCartReminder \? 4000 : 7000/);
 assert.match(common,/body > \.toast-stack--cart-reminder/);
 assert.match(common,/z-index: 2147483100/);
});
test("shipping reward is announced above physical items only when qualified",()=>{
 assert.match(cart,/merchandiseTotal >= FREE_SHIPPING_TARGET/);
 assert.match(cart,/FREE SHIPPING UNLOCKED/);
 assert.match(cart,/cart-free-shipping-unlocked/);
});
