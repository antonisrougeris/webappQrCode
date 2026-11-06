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
  BOXNOW_MONITOR_ERROR_THRESHOLD,
  isMonitorCandidate,
  extractBoxNowParcelSnapshot,
  shouldReconcileBoxNowEvent,
  needsBoxNowPickupAttention,
  shouldSendBoxNowPickupReminder,
  needsBoxNowReturnReview,
  isFinalizedBoxNowMonitorEvent,
} from "./boxnow-monitor-policy.js";

const ALERT_COLLECTION = "boxnow_shipping_monitor_alerts";
const ALERT_LEASE_MS = 15 * 60_000;
const inFlightOrderChecks = new Map();

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

function alertId(orderId, kind) {
  return crypto.createHash("sha256").update(String(orderId) + ":" + kind).digest("hex");
}

// Transactional claim prevents duplicate messages during overlapping polls or PM2 restarts.
async function sendOnce(db, order, kind, { subject, html, to }) {
  if (!to) {
    console.warn("boxnow_monitor_alert_no_recipient", { orderId: order.id, kind });
    return false;
  }
  const ref = db.collection(ALERT_COLLECTION).doc(alertId(order.id, kind));
  const owner = crypto.randomUUID();
  const acquired = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const v = snap.exists ? snap.data() : {};
    if (v.sentAt) return "already_sent";
    if (Date.parse(v.leaseUntil || "") > Date.now()) return "in_flight";
    tx.set(ref, {
      orderId: order.id, kind, owner,
      leaseUntil: new Date(Date.now() + ALERT_LEASE_MS).toISOString(),
      claimedAt: nowIso(),
    }, { merge: true });
    return "acquired";
  });
  if (acquired === "already_sent") return true;
  if (acquired !== "acquired") return false;
  try {
    await sendEmail({
      from: process.env.EMAIL_ORDER || process.env.EMAIL_FROM,
      to, subject, html,
    });
    await ref.set({ sentAt: nowIso(), leaseUntil: nowIso(), owner: null }, { merge: true });
    return true;
  } catch (error) {
    // Lease expires and next monitor run retries. Do not fail all remaining orders.
    console.error("boxnow_monitor_alert_failed", {
      orderId: order.id, kind, message: error.message,
    });
    return false;
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

// A terminal parcel is archived only AFTER its review alert was persisted.
async function stopPollingAfterTerminalAlert(db, order, snapshot) {
  if (!isFinalizedBoxNowMonitorEvent(snapshot.event)) return false;

  const orderRef = db.collection(COLLECTIONS.ORDERS).doc(order.id);
  const alertRef = db.collection(ALERT_COLLECTION).doc(
    alertId(order.id, "return-review:" + snapshot.parcelId)
  );
  const stopped = await db.runTransaction(async tx => {
    const [orderDoc, alertDoc] = await Promise.all([
      tx.get(orderRef),
      tx.get(alertRef),
    ]);
    if (!orderDoc.exists || !alertDoc.exists || !alertDoc.data()?.sentAt) return false;
    const current = { id: orderDoc.id, ...orderDoc.data() };
    if (!isMonitorCandidate(current) ||
      !isMatchingBoxNowProductionOrder(current, {
        orderNumber: current.orderNumber, parcelId: snapshot.parcelId,
      })) return false;

    const recordedEvent = String(
      current.shipping?.boxnow?.lastEvent || current.shipping?.status || ""
    ).trim().toLowerCase();
    const normalizedRecorded = recordedEvent === "canceled" ? "cancelled" : recordedEvent;
    const normalizedIncoming = snapshot.event === "canceled" ? "cancelled" : snapshot.event;
    if (normalizedRecorded !== normalizedIncoming ||
      !current.shipping?.monitor?.attentionRequired) return false;

    tx.update(orderRef, {
      "shipping.monitor.terminalMonitoringEvent": normalizedIncoming,
      "shipping.monitor.terminalMonitoringStoppedAt": nowIso(),
    });
    return true;
  });

  if (stopped) {
    console.info("boxnow_monitor_terminal_stopped", {
      orderId: order.id, parcelId: snapshot.parcelId, event: snapshot.event,
    });
  }
  return stopped;
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
    const reviewAlertSent = await sendOnce(db, order, "return-review:" + parcelId, {
      to: process.env.ADMIN_EMAIL,
      subject: "SKANARE BOX NOW — Returned / uncollected parcel needs review",
      html: message(order, "BOX NOW parcel " + parcelId + " is " + snapshot.event +
        ". Confirm the physical return and review next steps. No automatic refund was issued."),
    });
    if (reviewAlertSent && isFinalizedBoxNowMonitorEvent(snapshot.event)) {
      await stopPollingAfterTerminalAlert(db, order, snapshot);
    }
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

/**
 * Event-driven reconciliation: only the order that changed is read.
 * No 30-minute background timer, global lease, or query over all orders.
 * Webhooks remain authoritative and this is a one-shot recovery check.
 *
 * Multiple requests in the same Node process share one check. Firestore
 * transactions and alert leases still protect provider event updates and
 * email notifications across multiple workers.
 */
export async function checkBoxNowOrderNow(orderId, { source = "manual" } = {}) {
  const id = String(orderId || "").trim();
  if (!id) return { skipped: true, reason: "missing_order" };
  if (!isEnabled()) return { skipped: true, reason: "monitor_disabled" };
  if (inFlightOrderChecks.has(id)) return inFlightOrderChecks.get(id);
  const promise = (async () => {
    const snap = await getDB().collection(COLLECTIONS.ORDERS).doc(id).get();
    if (!snap.exists) return { skipped: true, reason: "order_not_found" };
    const order = { id: snap.id, ...snap.data() };
    if (!isMonitorCandidate(order)) {
      return { skipped: true, reason: "not_eligible" };
    }
    await processOrder(getDB(), order);
    console.info("boxnow_order_checked", { orderId: id, source });
    return { checked: true, orderId: id };
  })().finally(() => inFlightOrderChecks.delete(id));
  inFlightOrderChecks.set(id, promise);
  return promise;
}

/**
 * Run a check only in response to a real order change. Never throw into a
 * successful payment/admin operation if the carrier API is unavailable.
 */
export function triggerBoxNowOrderCheck(orderId, source = "order_change") {
  void checkBoxNowOrderNow(orderId, { source }).catch(error => {
    console.error("boxnow_event_check_failed", {
      orderId: String(orderId), source, message: error?.message,
    });
  });
}
