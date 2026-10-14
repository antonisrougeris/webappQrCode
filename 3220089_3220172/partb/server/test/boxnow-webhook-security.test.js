import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  extractRawDataObject,
  verifyBoxNowSignature,
  identifyBoxNowWebhookEnvironment,
  isValidBoxNowStageParcelId,
  isMatchingBoxNowProductionOrder,
  isBoxNowDeliveryCompletedEvent,
  appendBoxNowTrackingEvent,
  shouldIgnoreBoxNowEvent,
} from "../src/services/boxnow-webhook.service.js";

const secret = "boxnow-test-secret";

function sign(rawData) {
  return crypto.createHmac("sha256", secret).update(rawData, "utf8").digest("hex");
}

test("extracts exact raw BOX NOW data object", () => {
  const raw = '{"id":"msg-1","data": { "event":"delivered", "parcelId":"P1" },"other":true}';
  assert.equal(
    extractRawDataObject(Buffer.from(raw)),
    '{ "event":"delivered", "parcelId":"P1" }'
  );
});

test("accepts valid BOX NOW HMAC signature", () => {
  const previous = process.env.BOXNOW_WEBHOOK_SECRET;
  process.env.BOXNOW_WEBHOOK_SECRET = secret;

  const rawData = '{"event":"delivered","parcelId":"P1","orderNumber":"S-1"}';
  const rawBody = Buffer.from('{"id":"msg-1","data":' + rawData + '}');

  try {
    assert.equal(
      verifyBoxNowSignature({
        rawBody,
        signature: sign(rawData),
      }),
      true
    );
  } finally {
    if (previous === undefined) delete process.env.BOXNOW_WEBHOOK_SECRET;
    else process.env.BOXNOW_WEBHOOK_SECRET = previous;
  }
});

test("rejects invalid BOX NOW signature", () => {
  const previous = process.env.BOXNOW_WEBHOOK_SECRET;
  process.env.BOXNOW_WEBHOOK_SECRET = secret;
  const rawBody = Buffer.from('{"data":{"event":"delivered","parcelId":"P1"}}');

  try {
    assert.throws(
      () => verifyBoxNowSignature({ rawBody, signature: "0".repeat(64) }),
      /Invalid BOX NOW webhook signature/
    );
  } finally {
    if (previous === undefined) delete process.env.BOXNOW_WEBHOOK_SECRET;
    else process.env.BOXNOW_WEBHOOK_SECRET = previous;
  }
});

test("rejects missing BOX NOW signature", () => {
  const previous = process.env.BOXNOW_WEBHOOK_SECRET;
  process.env.BOXNOW_WEBHOOK_SECRET = secret;

  try {
    assert.throws(
      () =>
        verifyBoxNowSignature({
          rawBody: Buffer.from('{"data":{"event":"delivered"}}'),
          signature: "",
        }),
      /Missing BOX NOW webhook signature/
    );
  } finally {
    if (previous === undefined) delete process.env.BOXNOW_WEBHOOK_SECRET;
    else process.env.BOXNOW_WEBHOOK_SECRET = previous;
  }
});

test("rejects webhook verification when secret is not configured", () => {
  const previous = process.env.BOXNOW_WEBHOOK_SECRET;
  delete process.env.BOXNOW_WEBHOOK_SECRET;

  try {
    assert.throws(
      () =>
        verifyBoxNowSignature({
          rawBody: Buffer.from('{"data":{"event":"delivered"}}'),
          signature: "0".repeat(64),
        }),
      /secret is not configured/
    );
  } finally {
    if (previous !== undefined) process.env.BOXNOW_WEBHOOK_SECRET = previous;
  }
});

test("rejects malformed raw body without data object", () => {
  assert.throws(
    () => extractRawDataObject(Buffer.from('{"id":"msg-1","event":"delivered"}')),
    /does not contain data object/
  );
});

test("ignores duplicate BOX NOW event with the same timestamp", () => {
  assert.equal(
    shouldIgnoreBoxNowEvent(
      "2026-10-01T09:00:00.000Z",
      "2026-10-01T09:00:00.000Z"
    ),
    true
  );
});

test("ignores BOX NOW event older than the last processed event", () => {
  assert.equal(
    shouldIgnoreBoxNowEvent(
      "2026-10-01T09:00:00.000Z",
      "2026-10-01T08:59:59.000Z"
    ),
    true
  );
});

test("accepts a newer BOX NOW event", () => {
  assert.equal(
    shouldIgnoreBoxNowEvent(
      "2026-10-01T09:00:00.000Z",
      "2026-10-01T09:00:01.000Z"
    ),
    false
  );
});

test("accepts first BOX NOW event when no previous timestamp exists", () => {
  assert.equal(
    shouldIgnoreBoxNowEvent(null, "2026-10-01T09:00:00.000Z"),
    false
  );
});

test("identifies a staging-signed BOX NOW v1.5 event without accepting it as production", () => {
  const beforeMode = process.env.BOXNOW_MODE;
  const beforeProd = process.env.BOXNOW_WEBHOOK_SECRET;
  const beforeStage = process.env.BOXNOW_STAGE_WEBHOOK_SECRET;
  process.env.BOXNOW_MODE = "production";
  process.env.BOXNOW_WEBHOOK_SECRET = "production-only-secret";
  process.env.BOXNOW_STAGE_WEBHOOK_SECRET = secret;
  const data = '{ "parcelId":"6423451087", "event":"delivered", "time":"2026-10-12T18:00:00Z" }';
  const rawBody = Buffer.from('{"id":"stage-event","datasignature":"", "data":'+data+'}');
  try {
    assert.equal(
      identifyBoxNowWebhookEnvironment({ rawBody, signature: sign(data) }),
      "stage"
    );
    const productionHash = crypto.createHmac("sha256", "production-only-secret")
      .update(data).digest("hex");
    assert.equal(
      identifyBoxNowWebhookEnvironment({ rawBody, signature: productionHash }),
      "production"
    );
  } finally {
    if (beforeMode === undefined) delete process.env.BOXNOW_MODE;
    else process.env.BOXNOW_MODE = beforeMode;
    if (beforeProd === undefined) delete process.env.BOXNOW_WEBHOOK_SECRET;
    else process.env.BOXNOW_WEBHOOK_SECRET = beforeProd;
    if (beforeStage === undefined) delete process.env.BOXNOW_STAGE_WEBHOOK_SECRET;
    else process.env.BOXNOW_STAGE_WEBHOOK_SECRET = beforeStage;
  }
});

test("rejects production/staging using the same secret", () => {
  const beforeProd = process.env.BOXNOW_WEBHOOK_SECRET;
  const beforeStage = process.env.BOXNOW_STAGE_WEBHOOK_SECRET;
  process.env.BOXNOW_WEBHOOK_SECRET = secret;
  process.env.BOXNOW_STAGE_WEBHOOK_SECRET = secret;
  try {
    assert.throws(
      () => identifyBoxNowWebhookEnvironment({
        rawBody: Buffer.from('{"data":{"event":"delivered"}}'),
        signature: "0".repeat(64),
      }),
      /must be different/
    );
  } finally {
    if (beforeProd === undefined) delete process.env.BOXNOW_WEBHOOK_SECRET;
    else process.env.BOXNOW_WEBHOOK_SECRET = beforeProd;
    if (beforeStage === undefined) delete process.env.BOXNOW_STAGE_WEBHOOK_SECRET;
    else process.env.BOXNOW_STAGE_WEBHOOK_SECRET = beforeStage;
  }
});

test("rejects invalid signature even when two environment keys are configured", () => {
  const beforeMode = process.env.BOXNOW_MODE;
  const beforeProd = process.env.BOXNOW_WEBHOOK_SECRET;
  const beforeStage = process.env.BOXNOW_STAGE_WEBHOOK_SECRET;
  process.env.BOXNOW_MODE = "production";
  process.env.BOXNOW_WEBHOOK_SECRET = "different-production-secret";
  process.env.BOXNOW_STAGE_WEBHOOK_SECRET = secret;
  try {
    assert.throws(
      () => identifyBoxNowWebhookEnvironment({
        rawBody: Buffer.from('{"data":{"event":"delivered"}}'),
        signature: "0".repeat(64),
      }),
      /Invalid BOX NOW webhook signature/
    );
  } finally {
    if (beforeMode === undefined) delete process.env.BOXNOW_MODE;
    else process.env.BOXNOW_MODE = beforeMode;
    if (beforeProd === undefined) delete process.env.BOXNOW_WEBHOOK_SECRET;
    else process.env.BOXNOW_WEBHOOK_SECRET = beforeProd;
    if (beforeStage === undefined) delete process.env.BOXNOW_STAGE_WEBHOOK_SECRET;
    else process.env.BOXNOW_STAGE_WEBHOOK_SECRET = beforeStage;
  }
});

test("staging parcel ID validation accepts BOX NOW 10-digit tracking IDs", () => {
  assert.equal(isValidBoxNowStageParcelId("6423451087"), true);
  assert.equal(isValidBoxNowStageParcelId("9999999999"), true);
  assert.equal(isValidBoxNowStageParcelId("642345108"), false);
  assert.equal(isValidBoxNowStageParcelId("64234510878"), false);
  assert.equal(isValidBoxNowStageParcelId("642345108x"), false);
});

test("production event may complete only the matching paid production BOX NOW parcel", () => {
  const order = {
    orderNumber: "SK-EXAMPLE-1",
    delivery: "boxnow",
    paymentStatus: "paid",
    shipping: {
      status: "created",
      parcelId: "6704219453",
      boxnow: { environment: "production", parcelIds: ["6704219453"] },
    },
  };
  assert.equal(isMatchingBoxNowProductionOrder(order, {
    orderNumber: "SK-EXAMPLE-1", parcelId: "6704219453",
  }), true);
  assert.equal(isMatchingBoxNowProductionOrder(order, {
    orderNumber: "SK-EXAMPLE-1", parcelId: "6423451087",
  }), false);
  assert.equal(isMatchingBoxNowProductionOrder(order, {
    orderNumber: "SK-SOMEONE-ELSE", parcelId: "6704219453",
  }), false);
  assert.equal(isMatchingBoxNowProductionOrder({
    ...order, paymentStatus: "pending",
  }, { orderNumber: "SK-EXAMPLE-1", parcelId: "6704219453" }), false);
  assert.equal(isMatchingBoxNowProductionOrder({
    ...order, delivery: "courier",
  }, { orderNumber: "SK-EXAMPLE-1", parcelId: "6704219453" }), false);
  assert.equal(isMatchingBoxNowProductionOrder({
    ...order, shipping: { ...order.shipping, boxnow: { environment: "stage", parcelIds: ["6704219453"] } },
  }, { orderNumber: "SK-EXAMPLE-1", parcelId: "6704219453" }), false);
});

test("legacy paid BOX NOW orders can match stored parcelId without parcelIds array", () => {
  assert.equal(isMatchingBoxNowProductionOrder({
    orderNumber: "SK-LEGACY-1",
    paymentStatus: "paid",
    delivery: "boxnow",
    shipping: { parcelId: "6704219453" },
  }, { orderNumber: "SK-LEGACY-1", parcelId: "6704219453" }), true);
});

test("final-destination does not complete the order; only delivered does", () => {
  assert.equal(isBoxNowDeliveryCompletedEvent("final-destination"), false);
  assert.equal(isBoxNowDeliveryCompletedEvent("in-depot"), false);
  assert.equal(isBoxNowDeliveryCompletedEvent("expired"), false);
  assert.equal(isBoxNowDeliveryCompletedEvent("delivered"), true);
});

test("production event history is bounded to the last 30 entries", () => {
  const previous = Array.from({ length: 30 }, (_, i) => ({ event: "in-depot", eventTime: i }));
  const history = appendBoxNowTrackingEvent(previous, { event: "delivered", eventTime: 31 });
  assert.equal(history.length, 30);
  assert.equal(history[0].eventTime, 1);
  assert.equal(history.at(-1).event, "delivered");
});
