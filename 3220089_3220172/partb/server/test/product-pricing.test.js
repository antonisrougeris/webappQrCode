import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateDiscountedPrice,
  decorateProductPricing,
  normalizeDiscountPercent,
  normalizeDiscountAmount,
  calculateProductDiscountedPrice,
  getEffectiveUnitPrice,
  normalizeMerchandisingTag,
} from "../src/services/product-pricing.service.js";

test("discount percent supports decimals", () => {
  assert.equal(normalizeDiscountPercent(-20), 0);
  assert.equal(normalizeDiscountPercent(12.6), 12.6);
  assert.equal(normalizeDiscountPercent(12.345), 12.35);
  assert.equal(normalizeDiscountPercent(500), 90);
});

test("discounted price is rounded to cents", () => {
  assert.equal(
    calculateDiscountedPrice(29.9, 20),
    23.92
  );

  assert.equal(
    calculateDiscountedPrice(12.9, 15),
    10.97
  );
});

test("storefront pricing preserves original price and derives badge", () => {
  const product =
    decorateProductPricing({
      price: 29.9,
      discountPercent: 20,
      merchandisingTag: "best-seller",
      featured: true,
    });

  assert.equal(product.price, 23.92);
  assert.equal(product.priceEUR, 23.92);
  assert.equal(product.originalPrice, 29.9);
  assert.equal(product.discountPercent, 20);
  assert.equal(product.onSale, true);
  assert.equal(
    product.merchandisingTag,
    "best_seller"
  );
  assert.equal(product.badge, "Best seller");
});

test("featured controls placement and is not an automatic badge", () => {
  const product =
    decorateProductPricing({
      price: 19.9,
      featured: true,
    });

  assert.equal(product.featured, true);
  assert.equal(product.badge, "");
  assert.equal(product.price, 19.9);
  assert.equal(product.originalPrice, 19.9);
});

test("unknown merchandising tag is treated as none", () => {
  assert.equal(
    normalizeMerchandisingTag("whatever"),
    "none"
  );
});

test("fixed euro and fractional percent discounts match checkout and storefront",()=>{
 const raw={price:29.90,discountType:"amount",discountAmount:10};
 assert.equal(normalizeDiscountAmount(10.129),10.13);
 assert.equal(calculateProductDiscountedPrice(29.9,raw),19.9);
 assert.equal(getEffectiveUnitPrice(raw),19.9);
 const shown=decorateProductPricing(raw);
 assert.equal(shown.price,19.9);
 assert.equal(shown.originalPrice,29.9);
 assert.equal(shown.onSale,true);
 assert.equal(calculateProductDiscountedPrice(25,{discountType:"percent",discountPercent:12.5}),21.88);
});
