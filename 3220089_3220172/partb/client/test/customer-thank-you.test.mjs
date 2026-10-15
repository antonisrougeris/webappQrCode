import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const home = readFileSync("src/main.ts", "utf8");
const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/boxnow-tracking.css", "utf8");

test("thank-you is standalone above orders and never injected into order cards", () => {
  assert.ok(html.indexOf('id="customerThankYou"') < html.indexOf('id="userOrdersList"'));
  assert.ok(html.includes('id="customerThankYouMessage"'));
  assert.doesNotMatch(home, /account-order__review-reminder/);
  assert.match(css, /\.customer-thank-you\[hidden\]/);
});
test("completed order review invitation switches to contact after review", () => {
  assert.match(home, /const completed = getCustomerOrderStatus\(latestOrder\) === "completed"/);
  assert.match(home, /reviewedIds\.has\(id\)/);
  assert.match(home, /#productReviews/);
  assert.match(home, /20% off/);
  assert.match(home, /action\.href = localizedPath\("\/contact", locale\)/);
  assert.match(home, /Contact us/);
});
test("dashboard fetches reviews with other data and cleans up when signed out", () => {
  assert.match(home, /Promise\.allSettled\(\[\s*getOrders\(\),\s*getMyQrCodes\(\),\s*getCustomerReturns\(\),\s*getMyReviewedProductIds\(\)/);
  assert.match(home, /reviewedIds = reviewsResult\.status === "fulfilled" \? reviewsResult\.value : null/);
  assert.match(home, /renderCustomerThankYou\(orders, reviewedIds\)/);
  assert.match(home, /resetLoggedOutHomepageState[\s\S]*thankYouPanel\.hidden = true/);
});

test("all paid orders show Contact before delivery; latest order determines state", () => {
  assert.match(home, /const latestOrder = \[\.\.\.orders\]\.sort/);
  assert.match(home, /if \(!latestOrder\) \{/);
  assert.match(home, /const eligibleItem = completed && reviewedIds !== null/);
  assert.match(home, /action\.href = localizedPath\("\/contact", locale\)/);
  assert.doesNotMatch(home, /if \(!completedOrders\.length\)/);
  assert.match(home, /Have a question about your order or need any help/);
});
