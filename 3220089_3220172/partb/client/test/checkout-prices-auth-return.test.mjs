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
 assert.match(code,/resumePayment/);
 assert.match(code,/window\.scrollTo\(/);
});

test("both collapsed mobile summaries show discounted and original totals",()=>{
  for (const id of ["checkoutMobileTopOriginalTotal","checkoutMobileSummaryOriginalTotal"])
    assert.ok(html.includes('id="'+id+'"'));
  assert.match(code,/function checkoutOriginalTotal\(/);
  assert.match(code,/updateCheckoutPreviewTotals\(items, total\)/);
});
test("VAT is inside total label and tax note aligns left",()=>{
  assert.match(html,/class="checkout-total__label"[\s\S]*?id="checkoutTaxNote"/);
  assert.match(html,/class="checkout-total__label"[\s\S]*?id="checkoutMobileTopTaxNote"/);
  assert.match(css,/\.checkout-tax-note \{[^}]*text-align: left/);
});
test("checkout header links route to actual categories",()=>{
  assert.match(html,/href="\/products\?category=tshirt"/);
  assert.match(html,/href="\/products\?category=accessory"/);
  assert.doesNotMatch(html,/href="#tshirts"/);
});
