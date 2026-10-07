import crypto from "node:crypto";

import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";

export function normalizeRecoveryCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 40);
}

export function recoveryOfferRef(code, db = getDB()) {
  return db
    .collection(COLLECTIONS.RECOVERY_OFFERS)
    .doc(normalizeRecoveryCode(code));
}

export function validateRecoveryOfferData(data, { email, code } = {}) {
  if (!data) {
    throw new ApiError(400, "Discount code is invalid");
  }

  const normalizedCode = normalizeRecoveryCode(code || data.code);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const offerEmail = String(data.email || "").trim().toLowerCase();
  const expiresAtRaw = String(data.expiresAt || "").trim();
  const expiresAt = expiresAtRaw ? Date.parse(expiresAtRaw) : null;
  const source =
    data.source === "manual"
      ? "manual"
      : data.source === "review"
        ? "review"
        : "recovery";

  if (!normalizedCode || data.status !== "active") {
    throw new ApiError(400, "Discount code is no longer active");
  }

  if (
    expiresAt !== null &&
    (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
  ) {
    throw new ApiError(400, "Discount code has expired");
  }

  if (offerEmail && normalizedEmail && offerEmail !== normalizedEmail) {
    throw new ApiError(400, "This discount code is not valid for this email");
  }

  const discountPercent = Number(data.discountPercent || 0);
  const maxPercent = source === "manual" ? 90 : 30;
  if (
    !Number.isFinite(discountPercent) ||
    discountPercent <= 0 ||
    discountPercent > maxPercent
  ) {
    throw new ApiError(400, "Discount code is invalid");
  }

  return {
    code: normalizedCode,
    discountPercent,
    email: offerEmail,
    expiresAt: data.expiresAt || null,
    reservedOrderId: data.reservedOrderId || null,
    source,
    minOrderAmount: Math.max(0, Number(data.minOrderAmount || 0)),
    usedCount: Math.max(0, Number(data.usedCount || 0)),
  };
}

export async function createRecoveryOffer({
  email,
  cartId,
  discountPercent,
  createdBy,
}) {
  const percent = Math.round(Number(discountPercent || 0));

  if (!Number.isInteger(percent) || percent < 1 || percent > 30) {
    throw new ApiError(400, "Discount must be between 1% and 30%");
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ApiError(400, "Customer email is required");
  }

  const code =
    `COME-BACK-${percent}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const data = {
    code,
    email: normalizedEmail,
    cartId: cartId ? String(cartId) : null,
    discountPercent: percent,
    status: "active",
    source: "recovery",
    maxUses: 1,
    createdBy: createdBy || null,
    createdAt,
    expiresAt,
    reservedOrderId: null,
    usedAt: null,
  };

  await recoveryOfferRef(code).set(data);

  return data;
}


export async function getActiveRecoveryOffer(code) {
  const normalizedCode = normalizeRecoveryCode(code);

  if (!normalizedCode) {
    throw new ApiError(400, "Discount code is required");
  }

  if (normalizedCode === "SKANARE10") {
    return {
      code: "SKANARE10",
      discountPercent: 10,
      expiresAt: null,
      source: "store",
    };
  }

  const snap = await recoveryOfferRef(normalizedCode).get();

  const offer = validateRecoveryOfferData(
    snap.exists ? snap.data() : null,
    { code: normalizedCode }
  );

  return {
    code: offer.code,
    discountPercent: offer.discountPercent,
    expiresAt: offer.expiresAt,
    source: offer.source,
    minOrderAmount: offer.minOrderAmount,
    usedCount: offer.usedCount,
  };
}

export async function listManualDiscountCodes() {
  const snapshot = await getDB()
    .collection(COLLECTIONS.RECOVERY_OFFERS)
    .where("source", "==", "manual")
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
}

export async function createManualDiscountCode({
  code,
  discountPercent,
  expiresAt = null,
  minOrderAmount = 0,
  createdBy = null,
}) {
  const normalizedCode = normalizeRecoveryCode(code);
  const percent = Math.round(Number(discountPercent || 0));
  const minimum = Math.max(0, Number(minOrderAmount || 0));

  if (!normalizedCode || normalizedCode.length < 3) {
    throw new ApiError(400, "Discount code must be at least 3 characters");
  }

  if (normalizedCode === "SKANARE10") {
    throw new ApiError(409, "SKANARE10 is a reserved store code");
  }

  if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
    throw new ApiError(400, "Discount must be between 1% and 90%");
  }

  let normalizedExpiry = null;
  if (expiresAt) {
    const parsed = Date.parse(String(expiresAt));
    if (!Number.isFinite(parsed) || parsed <= Date.now()) {
      throw new ApiError(400, "Expiry must be a future date");
    }
    normalizedExpiry = new Date(parsed).toISOString();
  }

  const ref = recoveryOfferRef(normalizedCode);
  const existing = await ref.get();
  if (existing.exists) {
    throw new ApiError(409, "Discount code already exists");
  }

  const createdAt = nowIso();
  const data = {
    code: normalizedCode,
    discountPercent: percent,
    minOrderAmount: minimum,
    status: "active",
    source: "manual",
    email: "",
    expiresAt: normalizedExpiry,
    createdBy,
    createdAt,
    updatedAt: createdAt,
    usedCount: 0,
  };

  await ref.set(data);
  return data;
}

export async function setManualDiscountCodeStatus({
  code,
  active,
}) {
  const normalizedCode = normalizeRecoveryCode(code);
  const ref = recoveryOfferRef(normalizedCode);
  const snap = await ref.get();

  if (!snap.exists || snap.data()?.source !== "manual") {
    throw new ApiError(404, "Discount code not found");
  }

  const status = active ? "active" : "inactive";
  await ref.set(
    {
      status,
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  return {
    code: normalizedCode,
    status,
  };
}
