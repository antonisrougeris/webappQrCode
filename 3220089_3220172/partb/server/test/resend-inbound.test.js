import test from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "standardwebhooks";

import {
  isAllowedInboundRecipient,
  verifyResendWebhook,
} from "../src/services/resend-inbound.service.js";

test("accepts the two public Skanare inboxes", () => {
  assert.equal(
    isAllowedInboundRecipient("info@skanare.com"),
    true
  );

  assert.equal(
    isAllowedInboundRecipient(
      "Skanare <hello@skanare.com>"
    ),
    true
  );
});

test("rejects other inbound recipients", () => {
  assert.equal(
    isAllowedInboundRecipient("sales@skanare.com"),
    false
  );

  assert.equal(
    isAllowedInboundRecipient("adminskanare@gmail.com"),
    false
  );
});

test("verifies a legitimate signed Resend email.received webhook", () => {
  const oldApiKey = process.env.RESEND_API_KEY;
  const oldSecret = process.env.RESEND_WEBHOOK_SECRET;
  try {
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
    const payload = JSON.stringify({ type: "email.received", data: { email_id: "received-email-id", to: ["hello@skanare.com"] } });
    const id = "msg_resend_inbound_test";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = new Webhook(process.env.RESEND_WEBHOOK_SECRET).sign(id, new Date(Number(timestamp) * 1000), payload);
    const event = verifyResendWebhook({
      rawBody: payload,
      headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature },
    });
    assert.equal(event.type, "email.received");
    assert.equal(event.data.email_id, "received-email-id");
    assert.throws(() => verifyResendWebhook({
      rawBody: payload + " ",
      headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature },
    }));
  } finally {
    if (oldApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldApiKey;
    if (oldSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = oldSecret;
  }
});
