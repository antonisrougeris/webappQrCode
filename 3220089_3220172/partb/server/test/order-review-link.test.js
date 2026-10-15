import test from "node:test";
import assert from "node:assert/strict";
import { getDeliveredOrderReviewUrl } from "../src/services/order-review-link.service.js";

test("delivered email links to first purchased product's reviews", () => {
  assert.equal(getDeliveredOrderReviewUrl({
    items: [{ slug: "test", productId: "p1" }],
  }), "https://skanare.com/product/test#productReviews");
});

test("multi-product orders use the first product, not the second", () => {
  assert.equal(getDeliveredOrderReviewUrl({
    items: [{ slug: "scan-to-discover-tshirt" }, { slug: "other" }],
  }), "https://skanare.com/product/scan-to-discover-tshirt#productReviews");
});

test("legacy orders can use first product ID when slug is absent", () => {
  assert.equal(getDeliveredOrderReviewUrl({
    items: [{ productId: "product_123" }, { slug: "other" }],
  }), "https://skanare.com/product/product_123#productReviews");
});

test("missing first product never silently redirects to a different item", () => {
  assert.equal(getDeliveredOrderReviewUrl({
    items: [{ title: "Unknown legacy item" }, { slug: "another-product" }],
  }), "https://skanare.com/products");
  assert.equal(getDeliveredOrderReviewUrl({ items: [] }), "https://skanare.com/products");
});

test("unsafe review identifiers are rejected, preventing email link injection", () => {
  assert.equal(getDeliveredOrderReviewUrl({
    items: [{ slug: "https://evil.example/redirect", productId: "../oops" }],
  }), "https://skanare.com/products");
  assert.equal(getDeliveredOrderReviewUrl({
    items: [{ slug: 'test\" onclick=\"evil' }],
  }), "https://skanare.com/products");
});
