import test from "node:test";
import assert from "node:assert/strict";

import {
  readReservationCountsAndSharedBreakdown,
} from "../src/services/inventory-reservation.service.js";

test("catalog reservation projections reuse a single Firestore query", async () => {
  let queryCount = 0;
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const db = {
    collection(name) {
      assert.equal(name, "inventoryHolds");
      return {
        async get() {
          queryCount++;
          return {
            docs: [
              { data: () => ({
                inventoryKey: "blank::BLACK__L",
                holds: [
                  { id: "active", quantity: 2, blankQuantity: 1, finishedQuantity: 1,
                    productId: "scan-me", sku: "BLACK-L", expiresAt },
                  { id: "expired", quantity: 3, blankQuantity: 3, finishedQuantity: 0,
                    productId: "scan-me", sku: "BLACK-L", expiresAt: expiredAt },
                ],
              }) },
              { data: () => ({
                inventoryKey: "accessory::SKU1",
                holds: [{ id: "accessory", quantity: 1, expiresAt }],
              }) },
            ],
          };
        },
      };
    },
  };

  const { counts, sharedHolds } = await readReservationCountsAndSharedBreakdown(db);
  assert.equal(queryCount, 1);
  assert.equal(counts.get("blank::BLACK__L"), 2);
  assert.equal(counts.get("accessory::SKU1"), 1);
  assert.equal(sharedHolds.blank.get("blank::BLACK__L"), 1);
  assert.equal(sharedHolds.finished.get("scan-me::BLACK-L"), 1);
});
