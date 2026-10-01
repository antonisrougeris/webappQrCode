import test from "node:test";
import assert from "node:assert/strict";
import { validateVivaWebhookTransaction } from "../src/services/viva.service.js";

const provider = {
  orderCode: "987654",
  statusId: "F",
  amount: 33.4,
};

function payload(overrides = {}) {
  return {
    EventData: {
      OrderCode: "987654",
      StatusId: "F",
      Amount: 33.4,
      ...overrides,
    },
  };
}

test("accepts matching completed Viva transaction", () => {
  const result = validateVivaWebhookTransaction(payload(), provider);
  assert.equal(result, provider);
});

test("rejects Viva amount mismatch", () => {
  assert.throws(
    () => validateVivaWebhookTransaction(payload({ Amount: 30 }), provider),
    /verification mismatch/
  );
});

test("rejects Viva order-code mismatch", () => {
  assert.throws(
    () => validateVivaWebhookTransaction(payload({ OrderCode: "WRONG" }), provider),
    /verification mismatch/
  );
});

test("rejects Viva status mismatch", () => {
  assert.throws(
    () => validateVivaWebhookTransaction(payload({ StatusId: "A" }), provider),
    /verification mismatch/
  );
});

test("rejects provider transaction that is not completed", () => {
  const pendingProvider = { ...provider, statusId: "A" };

  assert.throws(
    () =>
      validateVivaWebhookTransaction(
        payload({ StatusId: "A" }),
        pendingProvider
      ),
    /transaction is not completed/
  );
});

test("rejects zero or missing Viva amount", () => {
  assert.throws(
    () => validateVivaWebhookTransaction(payload({ Amount: 0 }), { ...provider, amount: 0 }),
    /verification mismatch/
  );
});
