import test from "node:test";
import assert from "node:assert/strict";
import { isStorefrontReadRequest } from "../src/middleware/rateLimits.js";

const qualifies = (method, url) => isStorefrontReadRequest({ method, originalUrl: url });

test("storefront browsing GETs have their own bounded budget", () => {
  assert.equal(qualifies("GET", "/api/cart"), true);
  assert.equal(qualifies("GET", "/api/cart?locale=el"), true);
  assert.equal(qualifies("GET", "/api/products/scan-me-tshirt?locale=en"), true);
  assert.equal(qualifies("HEAD", "/api/products"), true);
  assert.equal(qualifies("GET", "/api/reviews?productId=abc"), true);
});

test("cart mutations, authentication, checkout and admin never bypass general API protection", () => {
  for (const [method, path] of [
    ["POST", "/api/cart/items"],
    ["PATCH", "/api/cart/items/123"],
    ["DELETE", "/api/cart/items/123"],
    ["POST", "/api/auth/login"],
    ["GET", "/api/auth/me"],
    ["POST", "/api/checkout"],
    ["GET", "/api/admin/products"],
    ["GET", "/api/cartography"],
    ["POST", "/api/reviews"],
  ]) {
    assert.equal(qualifies(method, path), false, method + " " + path);
  }
});
