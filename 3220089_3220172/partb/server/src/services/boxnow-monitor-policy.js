// Pure helpers for read-only BOX NOW parcel snapshots and safe polling policy.
export const BOXNOW_MONITOR_INTERVAL_MS = 30 * 60_000;
export const BOXNOW_MONITOR_PICKUP_AGE_MS = 24 * 60 * 60_000;
export const BOXNOW_MONITOR_ERROR_THRESHOLD = 3;

const RESOLVED = new Set(["delivered", "returned", "cancelled", "canceled", "expired", "lost", "missing"]);
const TRACKABLE = new Set([
  "new", "accepted-to-locker", "in-depot", "in-transit",
  "wait-for-load", "in-final-destination", "final-destination",
  "accepted-for-return", ...RESOLVED,
]);

export function isMonitorCandidate(order) {
  if (!order || order.paymentStatus !== "paid" || order.delivery !== "boxnow") return false;
  if (order.shipping?.boxnow?.environment !== "production") return false;
  if (["cancelled", "completed"].includes(String(order.fulfillmentStatus || "").toLowerCase())) {
    return order.fulfillmentStatus === "completed"
      && order.completionSource === "boxnow_api_reconciliation"
      && !order.emails?.deliveredOrderSentAt;
  }
  const parcelId = String(order.shipping?.boxnow?.parcelIds?.[0] || order.shipping?.parcelId || "").trim();
  if (!/^[0-9]{10}$/.test(parcelId)) return false;
  return !["manual", "failed", "creating"].includes(String(order.shipping?.status || "").toLowerCase());
}

export function extractBoxNowParcelSnapshot(response, parcelId, expectedOrderNumber) {
  const items = Array.isArray(response?.data) ? response.data : [];
  const parcel = items.find(p => String(p?.id || "") === String(parcelId));
  if (!parcel) throw new Error("BOX NOW parcel missing from API response");

  // Do not let one API parcel ever complete a different Skanare order.
  const providerOrderNumber = String(parcel.deliveryRequest?.orderNumber || "").trim();
  if (providerOrderNumber && providerOrderNumber !== String(expectedOrderNumber || "").trim()) {
    throw new Error("BOX NOW provider order number mismatch");
  }

  const events = (Array.isArray(parcel.events) ? parcel.events : [])
    .map(e => ({ event: String(e?.type || "").trim().toLowerCase(), time: String(e?.createTime || "") }))
    .filter(e => TRACKABLE.has(e.event) && Number.isFinite(Date.parse(e.time)))
    .sort((a, z) => Date.parse(a.time) - Date.parse(z.time));

  const last = events.at(-1);
  const state = String(parcel.state || "").trim().toLowerCase();
  const updateTime = String(parcel.updateTime || "");
  const updateValid = Number.isFinite(Date.parse(updateTime));
  // Terminal parcel state is authoritative, even if events[] is incomplete.
  const authoritative = RESOLVED.has(state) && updateValid
    && (!last || Date.parse(updateTime) >= Date.parse(last.time))
      ? { event: state === "canceled" ? "cancelled" : state, time: updateTime }
      : last || (TRACKABLE.has(state) && updateValid ? { event: state, time: updateTime } : null);

  if (!authoritative) throw new Error("BOX NOW parcel has no timestamped known status");

  // BOX NOW does not always return an actual pickup expiry timestamp.
  const rawDeadline = parcel.pickupDeadline || parcel.pickupExpiryTime || null;
  const pickupDeadline = rawDeadline && Number.isFinite(Date.parse(String(rawDeadline)))
    ? new Date(rawDeadline).toISOString() : null;

  return {
    parcelId: String(parcel.id),
    event: authoritative.event,
    eventTime: new Date(authoritative.time).toISOString(),
    pickupDeadline,
  };
}

export function shouldReconcileBoxNowEvent(order, providerEventTime) {
  const previous = Date.parse(String(order?.shipping?.boxnow?.lastEventAt || ""));
  const incoming = Date.parse(String(providerEventTime || ""));
  return Number.isFinite(incoming) && (!Number.isFinite(previous) || incoming > previous);
}

export function needsBoxNowPickupAttention(snapshot, now = Date.now()) {
  return snapshot?.event === "final-destination"
    && now - Date.parse(snapshot.eventTime) >= BOXNOW_MONITOR_PICKUP_AGE_MS;
}

export function shouldSendBoxNowPickupReminder(snapshot, now = Date.now()) {
  if (snapshot?.event !== "final-destination" || !snapshot.pickupDeadline) return false;
  const remaining = Date.parse(snapshot.pickupDeadline) - now;
  return Number.isFinite(remaining) && remaining > 0 && remaining <= BOXNOW_MONITOR_PICKUP_AGE_MS;
}

export function needsBoxNowReturnReview(event) {
  return ["returned", "expired", "cancelled", "canceled", "lost", "missing"].includes(event);
}
