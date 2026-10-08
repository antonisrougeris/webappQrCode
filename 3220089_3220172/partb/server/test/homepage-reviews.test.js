import test from "node:test";
import assert from "node:assert/strict";
import { mapHomepageReviews } from "../src/services/review.service.js";

test("merges reviews collection and legacy embedded product reviews without duplicates", () => {
  const products = [{ id: "qr-keychain", data: {
    title: "QR Keychain", slug: "qr-keychain", active: true,
    reviews: [
      { name: "Ioanna", rating: 5, comment: "Small, practical and scans fast." },
      { name: "Nikos", rating: 4, comment: "Good item." }
    ]
  }}];
  const reviews = [
    { id: "review-one", data: { name: "Ioanna", rating: 5, comment: "Small, practical and scans fast.", productId: "qr-keychain" } },
    { id: "review-two", data: { name: "Alex", rating: 1, comment: "Not for me.", productId: "removed-product", verifiedPurchase: true } }
  ];
  const mapped = mapHomepageReviews(reviews, products);
  assert.equal(mapped.length, 3);
  assert.equal(mapped.filter(r => r.name === "Ioanna").length, 1);
  assert.ok(mapped.some(r => r.name === "Alex" && r.rating === 1));
  assert.equal(mapped.find(r => r.name === "Alex").verifiedPurchase, false);
  assert.equal(mapped.find(r => r.name === "Alex").productTitle, "");
  assert.equal(mapped.find(r => r.name === "Nikos").productTitle, "QR Keychain");
});
test("removes malformed reviews and excludes private fields", () => {
  const mapped = mapHomepageReviews([
    { id: "good", data: { name: "Buyer", rating: 5, comment: "Works.", productId: "x", verifiedPurchase: true, orderId: "o1", userId: "secret" } },
    { id: "bad", data: { name: "Bad", rating: 10, comment: "No.", productId: "x" } }
  ], []);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].verifiedPurchase, true);
  assert.equal("orderId" in mapped[0], false);
  assert.equal("userId" in mapped[0], false);
});
