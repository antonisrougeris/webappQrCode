import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("src/main.ts", "utf8");
const product = readFileSync("src/pages/product-details/product-details.ts", "utf8");

test("completed order hides original outbound BOX NOW tracking", () => {
  assert.match(home, /status !== "completed"\s*&&\s*Boolean\(trackingNumber \|\| trackingUrl\)/);
  assert.match(home, /\$\{tracking\}\s*\$\{returnTracking\}/);
});

test("completed order fetches real return status and uses return parcel, not outbound parcel", () => {
  assert.match(home, /apiRequest<\{ returns\?: OrderReturn\[\] \}>\("\/returns"\)/);
  assert.match(home, /request\.orderId === orderId/);
  assert.match(home, /returnParcelId = String\(activeReturn\?\.boxnow\?\.parcelId/);
  assert.match(home, /Track return/);
  assert.match(home, /returnId=\$\{encodeURIComponent\(activeReturn\.id\)\}/);
});

test("return action remains within the existing fourteen-day window and is hidden for active return", () => {
  assert.match(home, /!activeReturn && customerReturnWindowOpen\(order\)/);
  assert.match(home, /14 \* 24 \* 60 \* 60 \* 1000/);
});

test("desktop add to cart without size completes exactly once on size selection", () => {
  assert.match(product, /let pendingDesktopAddToCart = false/);
  assert.match(product, /onSizeSelected\?\.\(\)/);
  assert.match(product, /pendingDesktopAddToCart = false;[\s\S]*?addBtn\.click\(\)/);
  assert.match(product, /window\.matchMedia\("\(min-width: 601px\)"\)/);
  assert.match(product, /setupMobileProductPurchase\(addBtn\)/);
});
