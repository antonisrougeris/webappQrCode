import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  extractRawDataObject,
  verifyBoxNowSignature,
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
