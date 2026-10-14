import test from "node:test";
import assert from "node:assert/strict";
import {
  isMonitorCandidate, extractBoxNowParcelSnapshot, shouldReconcileBoxNowEvent,
  needsBoxNowPickupAttention, shouldSendBoxNowPickupReminder, needsBoxNowReturnReview,
} from "../src/services/boxnow-monitor-policy.js";

const productionOrder = {
  orderNumber: "SK-TEST", paymentStatus: "paid", delivery: "boxnow",
  fulfillmentStatus: "shipped",
  shipping: { status: "shipped", parcelId: "6704219453",
    boxnow: { environment: "production", parcelIds: ["6704219453"] } },
};

test("only paid, unresolved production BOX NOW shipments with valid IDs are polled", () => {
  assert.equal(isMonitorCandidate(productionOrder), true);
  assert.equal(isMonitorCandidate({ ...productionOrder, paymentStatus: "pending" }), false);
  assert.equal(isMonitorCandidate({ ...productionOrder, delivery: "manual" }), false);
  assert.equal(isMonitorCandidate({ ...productionOrder,
    shipping: { ...productionOrder.shipping, boxnow: { environment: "stage", parcelIds: ["6704219453"] } } }), false);
  assert.equal(isMonitorCandidate({ ...productionOrder, fulfillmentStatus: "completed" }), false);
  assert.equal(isMonitorCandidate({ ...productionOrder, fulfillmentStatus: "cancelled" }), false);
  assert.equal(isMonitorCandidate({ ...productionOrder,
    shipping: { ...productionOrder.shipping, parcelId: null, boxnow: { environment: "production", parcelIds: [] } } }), false);
  assert.equal(isMonitorCandidate({ ...productionOrder, fulfillmentStatus: "completed",
    completionSource: "boxnow_api_reconciliation" }), true);
  assert.equal(isMonitorCandidate({ ...productionOrder, fulfillmentStatus: "completed",
    completionSource: "boxnow_api_reconciliation", emails: { deliveredOrderSentAt: "2026-10-14" } }), false);
});

test("provider last event is normalized without personal data or signed label URLs", () => {
  const result = extractBoxNowParcelSnapshot({ data: [{
    id: "6704219453", deliveryRequest: { orderNumber: "SK-TEST" },
    state: "in-transit", updateTime: "2026-10-14T12:00:00Z",
    recipientEmail: "private@example.com",
    parcelLabelUrl: "https://example.org/token?authorization=secret",
    events: [{ type: "new", createTime: "2026-10-12T00:00:00Z" },
      { type: "final-destination", createTime: "2026-10-14T10:00:00Z" }],
  }] }, "6704219453", "SK-TEST");
  assert.deepEqual(result, { parcelId: "6704219453", event: "final-destination",
    eventTime: "2026-10-14T10:00:00.000Z", pickupDeadline: null });
});

test("delivered from provider state is recognized even with incomplete events", () => {
  const s = extractBoxNowParcelSnapshot({ data: [{
    id: "6704219453", state: "delivered", updateTime: "2026-10-14T12:00:00Z",
    events: [{ type: "in-depot", createTime: "2026-10-13T00:00:00Z" }],
  }] }, "6704219453", "SK-TEST");
  assert.equal(s.event, "delivered");
});

test("rejects provider parcel/order mismatch and missing IDs", () => {
  assert.throws(() => extractBoxNowParcelSnapshot({
    data: [{ id: "6704219453", deliveryRequest: { orderNumber: "OTHER" },
      state: "delivered", updateTime: "2026-10-14T12:00:00Z" }],
  }, "6704219453", "SK-TEST"), /order number mismatch/);
  assert.throws(() => extractBoxNowParcelSnapshot({ data: [] }, "6704219453", "SK-TEST"),
    /parcel missing/);
});

test("reconciliation is monotonic, never overwrites newer webhook events", () => {
  const o = { shipping: { boxnow: { lastEventAt: "2026-10-14T12:00:00Z" } } };
  assert.equal(shouldReconcileBoxNowEvent(o, "2026-10-14T11:59:00Z"), false);
  assert.equal(shouldReconcileBoxNowEvent(o, "2026-10-14T12:00:00Z"), false);
  assert.equal(shouldReconcileBoxNowEvent(o, "2026-10-14T12:01:00Z"), true);
});

test("pickup reminders require a real provider expiry; never guess the deadline", () => {
  const n = Date.parse("2026-10-14T12:00:00Z");
  const s = { event: "final-destination", eventTime: "2026-10-13T11:00:00Z",
    pickupDeadline: null };
  assert.equal(needsBoxNowPickupAttention(s, n), true);
  assert.equal(shouldSendBoxNowPickupReminder(s, n), false);
  assert.equal(shouldSendBoxNowPickupReminder({
    ...s, pickupDeadline: "2026-10-15T06:00:00Z",
  }, n), true);
  assert.equal(shouldSendBoxNowPickupReminder({
    ...s, pickupDeadline: "2026-10-14T11:00:00Z",
  }, n), false);
});

test("returned and missing shipments require admin review, not refunds", () => {
  for (const event of ["returned", "expired", "cancelled", "lost", "missing"]) {
    assert.equal(needsBoxNowReturnReview(event), true);
  }
  assert.equal(needsBoxNowReturnReview("delivered"), false);
});
