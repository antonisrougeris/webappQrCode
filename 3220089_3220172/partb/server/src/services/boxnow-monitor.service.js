import crypto from "node:crypto";

import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { nowIso } from "../utils/ids.js";
import { getBoxNowParcel } from "./boxnow.service.js";
import {
  isMatchingBoxNowProductionOrder,
  appendBoxNowTrackingEvent,
  sendDeliveredOrderEmail,
} from "./boxnow-webhook.service.js";
import { sendEmail } from "./email.service.js";
import {
  BOXNOW_MONITOR_INTERVAL_MS,
  BOXNOW_MONITOR_ERROR_THRESHOLD,
  isMonitorCandidate,
  extractBoxNowParcelSnapshot,
  shouldReconcileBoxNowEvent,
  needsBoxNowPickupAttention,
  shouldSendBoxNowPickupReminder,
  needsBoxNowReturnReview,
} from "./boxnow-monitor-policy.js";

const JOB_COLLECTION = "operational_jobs";
const ALERT_COLLECTION = "boxnow_shipping_monitor_alerts";
const LEASE_MS = 20 * 60_000;
const ALERT_LEASE_MS = 15 * 60_000;
const MAX_ORDERS = 40;
let timer = null;
let running = false;

const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function isEnabled() {
  return process.env.BOXNOW_MODE === "production"
    && process.env.NODE_ENV === "production"
    && process.env.BOXNOW_MONITOR_ENABLED !== "false";
}

function parcelIdFor(order) {
  return String(order?.shipping?.boxnow?.parcelIds?.[0] || order?.shipping?.parcelId || "").trim();
}

async function leaseJob(db) {
  const ref = db.collection(JOB_COLLECTION).doc("boxnow_shipping_monitor");
  const owner = crypto.randomUUID();
  const claimed = await db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    const state = doc.exists ? doc.data() : {};
    if (Date.parse(state.leaseUntil || "") > Date.now()) return false;
    tx.set(ref, {
      owner,
      leaseUntil: new Date(Date.now() + LEASE_MS).toISOString(),
      startedAt: nowIso(),
    }, { merge: true });
    return true;
  });
  return claimed ? { ref, owner } : null;
}

async function releaseJob(db, lease) {
  if (!lease) return;
  await db.runTransaction(async tx => {
    const snap = await tx.get(lease.ref);
    if (snap.data()?.owner !== lease.owner) return;
    tx.set(lease.ref, { leaseUntil: nowIso(), finishedAt: nowIso() }, { merge: true });
  });
}

function alertId(orderId, kind) {
  return crypto.createHash("sha256").update(String(orderId) + ":" + kind).digest("hex");
}

// Transactional claim prevents duplicate messages during overlapping polls or PM2 restarts.
async function sendOnce(db, order, kind, { subject, html, to }) {
  if (!to) {
    console.warn("boxnow_monitor_alert_no_recipient", { orderId: order.id, kind });
    return;
  }
  const ref = db.collection(ALERT_COLLECTION).doc(alertId(order.id, kind));
  const owner = crypto.randomUUID();
  const acquired = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const v = snap.exists ? snap.data() : {};
    if (v.sentAt || Date.parse(v.leaseUntil || "") > Date.now()) return false;
    tx.set(ref, {
      orderId: order.id, kind, owner,
      leaseUntil: new Date(Date.now() + ALERT_LEASE_MS).toISOString(),
      claimedAt: nowIso(),
    }, { merge: true });
    return true;
  });
  if (!acquired) return;
  try {
    await sendEmail({
      from: process.env.EMAIL_ORDER || process.env.EMAIL_FROM,
      to, subject, html,
    });
    await ref.set({ sentAt: nowIso(), leaseUntil: nowIso(), owner: null }, { merge: true });
  } catch (error) {
    // Lease expires and next monitor run retries. Do not fail all remaining orders.
    console.error("boxnow_monitor_alert_failed", {
      orderId: order.id, kind, message: error.message,
    });
  }
}

function message(order, paragraph) {
  const number = escapeHtml(order.orderNumber || order.id);
  return '<div style="font-family:Arial,sans-serif;color:#222;line-height:1.6">' +
    '<h2>SKANARE — BOX NOW Shipping Monitor</h2>' +
    '<p><b>Order:</b> ' + number + '</p><p>' + escapeHtml(paragraph) +
    '</p><p>Review the shipment and take any required action in the Skanare Admin panel.</p></div>';
}

async function markChecked(db, orderId, patch) {
  await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
    ...patch,
    "shipping.monitor.lastCheckedAt": nowIso(),
  });
}

async function recordFailure(db, order, error) {
  const ref = db.collection(COLLECTIONS.ORDERS).doc(order.id);
  const count = await db.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || !isMonitorCandidate(fresh.data())) return 0;
    const count = Math.min(100, Number(fresh.data()?.shipping?.monitor?.consecutiveErrors || 0) + 1);
    tx.update(ref, {
      "shipping.monitor.consecutiveErrors": count,
      "shipping.monitor.lastErrorAt": nowIso(),
      "shipping.monitor.lastCheckedAt": nowIso(),
    });
    return count;
  });
  console.warn("boxnow_monitor_lookup_failed", {
    orderId: order.id, attempts: count, message: error.message,
  });
  if (count >= BOXNOW_MONITOR_ERROR_THRESHOLD) {
    // One alert per calendar day, with automatic retry if sending fails.
    await sendOnce(db, order, "api-error:" + nowIso().slice(0, 10), {
      to: process.env.ADMIN_EMAIL,
      subject: "SKANARE BOX NOW — Tracking API needs attention",
      html: message(order, "The BOX NOW API has failed on " + count +
        " consecutive monitoring attempts. No order status has been changed."),
    });
  }
}

async function reconcile(db, order, snapshot) {
  const ref = db.collection(COLLECTIONS.ORDERS).doc(order.id);
  const result = await db.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return { updated: false };
    const current = { id: fresh.id, ...fresh.data() };
    if (!isMonitorCandidate(current) ||
      !isMatchingBoxNowProductionOrder(current, {
        orderNumber: current.orderNumber, parcelId: snapshot.parcelId,
      })) return { updated: false };

    const patch = {
      "shipping.monitor.lastCheckedAt": nowIso(),
      "shipping.monitor.lastSuccessAt": nowIso(),
      "shipping.monitor.consecutiveErrors": 0,
    };
    let updated = false;
    if (shouldReconcileBoxNowEvent(current, snapshot.eventTime)) {
      updated = true;
      const receivedAt = nowIso();
      Object.assign(patch, {
        "shipping.status": snapshot.event,
        "shipping.updatedAt": receivedAt,
        "shipping.boxnow.lastEvent": snapshot.event,
        "shipping.boxnow.lastEventAt": snapshot.eventTime,
        "shipping.boxnow.lastParcelId": snapshot.parcelId,
        "shipping.boxnow.lastUpdateSource": "boxnow_api_reconciliation",
        "shipping.boxnow.eventHistory": appendBoxNowTrackingEvent(
          current.shipping?.boxnow?.eventHistory, {
            event: snapshot.event, eventTime: snapshot.eventTime,
            parcelId: snapshot.parcelId, source: "boxnow_api_reconciliation", receivedAt,
          }
        ),
        updatedAt: receivedAt,
      });
      if (snapshot.event === "final-destination") {
        patch["shipping.readyForPickupAt"] = snapshot.eventTime;
      }
      if (snapshot.event === "delivered") {
        patch["shipping.deliveredAt"] = snapshot.eventTime;
        patch.fulfillmentStatus = "completed";
        patch.completedAt = snapshot.eventTime;
        patch.completionSource = "boxnow_api_reconciliation";
        patch.history = [
          ...(Array.isArray(current.history) ? current.history : []),
          { action: "order_completed", at: snapshot.eventTime,
            source: "boxnow_api_reconciliation", parcelId: snapshot.parcelId },
        ];
      }
      if (snapshot.event === "returned") patch["shipping.returnedAt"] = snapshot.eventTime;
      if (snapshot.event === "cancelled") patch["shipping.canceledAt"] = snapshot.eventTime;
    }
    if (needsBoxNowReturnReview(snapshot.event)) {
      patch["shipping.monitor.attentionRequired"] = true;
      patch["shipping.monitor.attentionReason"] = snapshot.event;
      patch["shipping.monitor.attentionSince"] =
        current.shipping?.monitor?.attentionSince || nowIso();
    }
    tx.update(ref, patch);
    return { updated, completed: updated && snapshot.event === "delivered" };
  });
  return result;
}

async function processOrder(db, order) {
  // Retry a delivered email if a prior reconciliation committed successfully
  // but the email service failed. No provider API call needed.
  if (order.fulfillmentStatus === "completed" &&
    order.completionSource === "boxnow_api_reconciliation" &&
    !order.emails?.deliveredOrderSentAt) {
    await sendDeliveredOrderEmail(order.id);
    return;
  }
  const parcelId = parcelIdFor(order);
  let snapshot;
  try {
    const response = await getBoxNowParcel({ parcelId });
    snapshot = extractBoxNowParcelSnapshot(response, parcelId, order.orderNumber);
  } catch (error) {
    await recordFailure(db, order, error);
    return;
  }

  const changed = await reconcile(db, order, snapshot);
  if (changed.updated) {
    console.info("boxnow_monitor_reconciled", {
      orderId: order.id, parcelId, event: snapshot.event,
    });
  }
  if (changed.completed) {
    try {
      await sendDeliveredOrderEmail(order.id);
    } catch (error) {
      console.error("boxnow_monitor_delivered_email_failed", {
        orderId: order.id, message: error.message,
      });
    }
  }
  if (changed.updated && snapshot.event !== "delivered") {
    await sendOnce(db, order, "reconciled:" + snapshot.eventTime, {
      to: process.env.ADMIN_EMAIL,
      subject: "SKANARE BOX NOW — Recovered missing tracking event",
      html: message(order, "The scheduled monitor recovered BOX NOW status " +
        snapshot.event + " because the latest webhook status was behind."),
    });
  }
  if (needsBoxNowReturnReview(snapshot.event)) {
    await sendOnce(db, order, "return-review:" + parcelId, {
      to: process.env.ADMIN_EMAIL,
      subject: "SKANARE BOX NOW — Returned / uncollected parcel needs review",
      html: message(order, "BOX NOW parcel " + parcelId + " is " + snapshot.event +
        ". Confirm the physical return and review next steps. No automatic refund was issued."),
    });
  }
  if (needsBoxNowPickupAttention(snapshot)) {
    await sendOnce(db, order, "pickup-delayed:" + parcelId, {
      to: process.env.ADMIN_EMAIL,
      subject: "SKANARE BOX NOW — Parcel awaiting locker collection",
      html: message(order, "Parcel " + parcelId +
        " has been at the destination locker for more than 24 hours. Check the actual BOX NOW pickup deadline."),
    });
  }
  // Customer reminder only if the provider explicitly returned a valid deadline.
  if (shouldSendBoxNowPickupReminder(snapshot) && order.customer?.email) {
    await sendOnce(db, order, "pickup-reminder:" + parcelId, {
      to: order.customer.email,
      subject: "SKANARE — Your BOX NOW parcel is waiting for pickup",
      html: '<div style="font-family:Arial,sans-serif;line-height:1.6">' +
        '<h2>Your parcel is waiting at the BOX NOW locker</h2>' +
        '<p>Order: ' + escapeHtml(order.orderNumber) + '</p>' +
        '<p>Please collect it before ' + escapeHtml(snapshot.pickupDeadline) + '.</p>' +
        '<p>Tracking: <a href="https://boxnow.gr/?track=' +
        encodeURIComponent(parcelId) + '">BOX NOW</a></p></div>',
    });
  }
}

export async function runBoxNowShippingMonitor() {
  if (!isEnabled() || running) return { skipped: true };
  running = true;
  let lease;
  try {
    const db = getDB();
    lease = await leaseJob(db);
    if (!lease) return { skipped: true, reason: "leased" };
    const query = await db.collection(COLLECTIONS.ORDERS)
      .where("shipping.boxnow.environment", "==", "production").get();
    const candidates = query.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(isMonitorCandidate)
      .sort((a, b) => Date.parse(a.shipping?.monitor?.lastCheckedAt || "") -
        Date.parse(b.shipping?.monitor?.lastCheckedAt || ""));
    // Finite, low-concurrency polling; other orders are picked next run.
    const batch = candidates.slice(0, MAX_ORDERS);
    let processed = 0;
    for (const order of batch) {
      try {
        await processOrder(db, order);
        processed += 1;
      } catch (error) {
        console.error("boxnow_monitor_order_failed", {
          orderId: order.id, message: error.message,
        });
      }
    }
    console.info("boxnow_monitor_completed", { processed, eligible: candidates.length });
    return { processed, eligible: candidates.length };
  } catch (error) {
    console.error("boxnow_monitor_run_failed", { message: error.message });
    return { error: true };
  } finally {
    if (lease) {
      try { await releaseJob(getDB(), lease); }
      catch (error) { console.error("boxnow_monitor_release_failed", error.message); }
    }
    running = false;
  }
}

export function startBoxNowShippingMonitor() {
  if (!isEnabled()) {
    console.info("boxnow_monitor_disabled");
    return;
  }
  if (timer) return;
  console.info("boxnow_monitor_started", { intervalMinutes: 30, batchLimit: MAX_ORDERS });
  // Startup delay avoids competing with deployment health checks and initial API setup.
  const startup = setTimeout(() => { void runBoxNowShippingMonitor(); }, 120_000);
  startup.unref();
  timer = setInterval(() => { void runBoxNowShippingMonitor(); }, BOXNOW_MONITOR_INTERVAL_MS);
  timer.unref();
}

export function stopBoxNowShippingMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}
