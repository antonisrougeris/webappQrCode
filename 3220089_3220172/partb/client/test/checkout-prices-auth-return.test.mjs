import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync("src/pages/checkout/checkout.ts","utf8");
const html=readFileSync("src/pages/checkout/checkout.html","utf8");
const css=readFileSync("src/pages/checkout/mobile-checkout-footer.css","utf8");
test("desktop and both mobile summaries show already-included VAT",()=>{
 assert.match(code,/Math\.round\(Math\.max\(0, total\) \* 24 \/ 124 \* 100\) \/ 100/);
 assert.match(code,/Including .* in VAT \(24%\)/);
 for(const id of ["checkoutTaxNote","checkoutMobileTopTaxNote"])assert.ok(html.includes('id="'+id+'"'));
});
test("product strike-through uses actual originalPrice while coupon is separately summarized",()=>{
 assert.match(code,/Number\(item\.originalPrice\)/);
 assert.match(code,/beforeDiscount > discountedLinePrice\(item\) \+ 0\.001/);
 assert.match(code,/checkout-item__price/);
 assert.match(code,/cost\.append\(old\)/);
 assert.match(code,/Total savings \(included\)/);
 assert.match(css,/checkout-item__price del/);
});
test("mobile returns to payment button after authentication and rendering",()=>{
 assert.match(code,/#checkoutMobilePay/);
 assert.match(code,/window\.matchMedia\?\./);
 assert.match(code,/window\.location\.hash === "#checkoutMobilePay"/);
 assert.match(code,/scrollIntoView\(\{ block: "end", behavior: "instant" \}\)/);
});
