import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("src/pages/checkout/checkout.html", "utf8");
const code = readFileSync("src/pages/checkout/checkout.ts", "utf8");
const css = readFileSync("src/pages/checkout/mobile-checkout-footer.css", "utf8");

test("mobile summary is positioned after the form and mobile payment is last", () => {
  assert.ok(html.indexOf('id="checkoutForm"') < html.indexOf('id="checkoutOrderSummary"'));
  assert.ok(html.indexOf('id="checkoutOrderSummary"') < html.indexOf('id="checkoutMobilePay"'));
  assert.match(html, /id="checkoutMobilePay"[\s\S]*?type="submit"[\s\S]*?form="checkoutForm"/);
  assert.match(html, /id="checkoutMobileSummaryToggle"[\s\S]*?aria-expanded="false"/);
});
test("desktop button and form remain intact with native terms validation", () => {
  assert.match(html, /id="checkoutForm"[\s\S]*?type="checkbox" id="checkoutTermsAccepted"[^>]*required/);
  assert.equal((html.match(/data-checkout-pay-button/g) || []).length, 2);
  assert.match(code, /\[data-checkout-pay-button\]/);
  assert.match(code, /formEl\.reportValidity\(\)/);
  assert.match(code, /checkoutSubmitting = true/);
});
test("mobile pay is not sticky and desktop is unaffected", () => {
  assert.match(code, /import "\.\/mobile-checkout-footer\.css"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /#checkoutForm > \.checkout-page__btn/);
  assert.match(css, /position: static !important/);
  assert.match(css, /\.checkout-mobile-payment/);
  assert.match(css, /\.checkout-mobile-summary__content \{ display: none; \}/);
  assert.match(css, /\.is-mobile-expanded \.checkout-mobile-summary__content/);
});
test("mobile order total mirrors discounted total including shipping and tips", () => {
  assert.match(code, /updateMobileOrderSummary\(items, total\)/);
  assert.match(code, /updateMobileOrderSummary\(\[\], 0\)/);
  assert.match(code, /price\.textContent = formatPrice\(total\)/);
  assert.match(code, /summary\.classList\.toggle\("is-mobile-expanded", expanded\)/);
});
