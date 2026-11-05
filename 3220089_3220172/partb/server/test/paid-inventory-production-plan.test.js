import test from "node:test";
import assert from "node:assert/strict";
import { isPaidCheckoutHold } from "../src/services/inventory-reservation.service.js";
import {
  buildPaidOrderDtfRequirements, normalizeDtfColor,
} from "../src/services/dtf-inventory.service.js";

test("checkout held stock is removed only for the paid order", () => {
  const orderId = "order-1";
  const arg = {
    orderId,
    orderItemIds: new Set(["item-1"]),
    checkoutHoldIds: new Set(["order:order-1:item-1"]),
  };
  assert.equal(isPaidCheckoutHold({
    id: "order:order-1:item-1", phase: "checkout",
    orderId: "order-1", orderItemId: "item-1",
  }, arg), true);
  assert.equal(isPaidCheckoutHold({
    id: "order:order-2:item-1", phase: "checkout",
    orderId: "order-2", orderItemId: "item-1",
  }, arg), false);
  assert.equal(isPaidCheckoutHold({
    id: "item-1", phase: "cart",
    orderId: "order-1", orderItemId: "item-1",
  }, arg), false);
  assert.equal(isPaidCheckoutHold({
    id: "order:order-1:item-2", phase: "checkout",
    orderId: "order-1", orderItemId: "item-2",
  }, arg), false);
});

test("QR print contrast and missing DTF work for paid black and white shirts", () => {
  assert.equal(normalizeDtfColor("Black"), "white");
  assert.equal(normalizeDtfColor("White"), "black");
  const result = buildPaidOrderDtfRequirements([
    { id: "finished", shortId: "A", fulfillmentMode: "preprinted",
      variant: { color: "Black", size: "L" } },
    { id: "modular", shortId: "B", orderItemId: "one",
      fulfillmentMode: "modular_qr", variant: { color: "Black", size: "XL" },
      qrConfig: { textPrint: "SCAN ME" } },
    { id: "new", shortId: "C", orderItemId: "two",
      fulfillmentMode: "made_to_order", variant: { color: "White", size: "S" },
      qrConfig: { textPrint: "SCAN TO DISCOVER" } },
  ]);
  assert.equal(result.qrTransfers.length, 2);
  assert.equal(result.qrPrints.length, 1);
  assert.equal(result.qrTransfers[0].inkColor, "white");
  assert.equal(result.qrTransfers[0].source, "physical_stock");
  assert.equal(result.qrTransfers[1].inkColor, "black");
  assert.equal(result.qrPrints[0].shortId, "C");
  assert.equal(result.needed.length, 6);
  assert.deepEqual(result.needed.map(x => x.type), [
    "logo", "neck", "text", "logo", "neck", "text",
  ]);
});

test("digital QR-only transfer is not a finished shirt", () => {
  const qrs = [{ id: "transfer", fulfillmentMode: "modular_qr",
    status: "available", physicalConfirmedAt: "2026-11-05",
    variant: { color: "Black", size: "L" } }];
  const result = buildPaidOrderDtfRequirements(qrs);
  assert.equal(result.qrTransfers.length, 1);
  assert.equal(result.qrPrints.length, 0);
});
