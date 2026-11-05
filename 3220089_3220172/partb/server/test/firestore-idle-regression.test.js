import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("production server does not start the idle Firestore SEO polling loop", () => {
  const app = read("../src/app.js");
  assert.doesNotMatch(app, /startStorefrontProductHtmlRefreshLoop\s*\(/);
});

test("public catalog does not scan all available QR documents to determine stock", () => {
  const productService = read("../src/services/product.service.js");
  assert.doesNotMatch(productService, /readReadyCounts\s*\(/);
  assert.doesNotMatch(productService, /where\s*\(\s*["']status["']\s*,\s*["']==["']\s*,\s*["']available["']\s*\)/);
  assert.match(productService, /readCatalogDocuments\(db\)/);
  assert.match(productService, /cacheStorefrontRead\("availability"/);
});

test("physical inventory mutations invalidate stock cache", () => {
  const holds = read("../src/services/inventory-reservation.service.js");
  const paid = read("../src/services/payment.service.js");
  assert.match(holds, /invalidateStorefrontReadCache\("availability"\)/);
  assert.match(paid, /invalidateStorefrontReadCache\("availability", "products"\)/);
});
