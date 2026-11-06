import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

test("server does not start a periodic BOX NOW Firestore polling loop", () => {
  const app = read("../src/app.js");
  const monitor = read("../src/services/boxnow-monitor.service.js");
  assert.doesNotMatch(app, /startBoxNowShippingMonitor\s*\(/);
  assert.doesNotMatch(monitor, /setInterval\s*\(/);
  assert.doesNotMatch(monitor, /\.where\("shipping\.boxnow\.environment"/);
  assert.doesNotMatch(monitor, /operational_jobs/);
});

test("one-order check uses direct document lookup and validates eligibility", () => {
  const monitor = read("../src/services/boxnow-monitor.service.js");
  assert.match(monitor, /\.doc\(id\)\.get\(\)/);
  assert.match(monitor, /isMonitorCandidate\(order\)/);
  assert.match(monitor, /inFlightOrderChecks\.has\(id\)/);
  assert.match(monitor, /processOrder\(getDB\(\), order\)/);
});

test("new production parcels and admin status changes trigger a targeted lookup", () => {
  const payment = read("../src/services/payment.service.js");
  const admin = read("../src/controllers/admin.controller.js");
  const routes = read("../src/routes/admin.routes.js");
  assert.match(payment, /triggerBoxNowOrderCheck\(order\.id, "parcel_created"\)/);
  assert.match(admin, /triggerBoxNowOrderCheck\(order\.id, "order_shipped"\)/);
  assert.match(admin, /triggerBoxNowOrderCheck\(orderId, "parcel_id_updated"\)/);
  assert.match(routes, /router\.post\("\/orders\/:id\/boxnow\/check", checkAdminOrderBoxNow\)/);
});

test("carrier webhooks remain enabled as primary order status update path", () => {
  const routes = read("../src/routes/boxnow.routes.js");
  assert.match(routes, /"\/webhook"/);
  assert.match(routes, /handleBoxNowWebhook/);
});
