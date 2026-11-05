import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureOrderDtfPlan, componentKey, componentSpec,
} from "../src/services/dtf-inventory.service.js";

test("paid order consumes physical transfers only once and records all shortages", async () => {
  const values = new Map();
  const record = (collection, id, value) => values.set(`${collection}/${id}`, { ...value });
  record("orders", "paid-1", { paymentStatus: "paid" });
  record("dtfComponentStock", componentKey(componentSpec("logo", "white")), { physicalQuantity: 1 });
  record("dtfComponentStock", componentKey(componentSpec("neck", "white", { size: "XL" })), { physicalQuantity: 1 });
  const db = {
    collection(name) {
      return { doc(id) { return { path: `${name}/${id}` }; } };
    },
    async runTransaction(fn) {
      const writes = [];
      const transaction = {
        async get(ref) {
          const value = values.get(ref.path);
          return { exists: Boolean(value), data: () => value };
        },
        set(ref, data, options) {
          writes.push([ref.path, data, options]);
        },
      };
      const result = await fn(transaction);
      for (const [path, data, options] of writes) {
        values.set(path, options?.merge ? { ...(values.get(path) || {}), ...data } : data);
      }
      return result;
    },
  };
  const qrs = ["first", "second"].map(id => ({
    id, shortId: id, orderItemId: id, fulfillmentMode: "made_to_order",
    variant: { color: "Black", size: "XL" },
    qrConfig: { textPrint: "SCAN ME" },
  }));
  const first = await ensureOrderDtfPlan("paid-1", qrs, { db });
  assert.equal(first.qrPrints.length, 2);
  assert.equal(first.components.length, 6);
  assert.equal(first.missing.length, 4);
  assert.equal(first.components.filter(x => x.source === "physical_stock").length, 2);

  const second = await ensureOrderDtfPlan("paid-1", qrs, { db });
  assert.deepEqual(second, first);
  assert.equal(values.get(`dtfComponentStock/${componentKey(componentSpec("logo", "white"))}`).physicalQuantity, 0);
  assert.equal(values.get(`dtfComponentStock/${componentKey(componentSpec("neck", "white", { size: "XL" }))}`).physicalQuantity, 0);
});

test("unpaid orders cannot consume DTF component stock", async () => {
  const db = {
    collection(name) { return { doc(id) { return { path: `${name}/${id}` }; } }; },
    async runTransaction(fn) {
      return fn({
        get: async () => ({ exists: true, data: () => ({ paymentStatus: "pending" }) }),
        set() { throw Error("unpaid stock write"); },
      });
    },
  };
  await assert.rejects(
    ensureOrderDtfPlan("unpaid", [{ id: "qr", fulfillmentMode: "made_to_order", variant: { color: "Black", size: "L" } }], { db }),
    /only allowed after payment/
  );
});
