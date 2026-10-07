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
    throw new ApiError(400, "Recovery discount is invalid");
  }

  const normalizedCode = normalizeRecoveryCode(code || data.code);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const offerEmail = String(data.email || "").trim().toLowerCase();
  const expiresAt = Date.parse(String(data.expiresAt || ""));

  if (!normalizedCode || data.status !== "active") {
    throw new ApiError(400, "Recovery discount is no longer active");
  }

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new ApiError(400, "Recovery discount has expired");
  }

  if (offerEmail && normalizedEmail && offerEmail !== normalizedEmail) {
    throw new ApiError(400, "Recovery discount is not valid for this email");
  }

  const discountPercent = Number(data.discountPercent || 0);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 30) {
    throw new ApiError(400, "Recovery discount is invalid");
  }

  return {
    code: normalizedCode,
    discountPercent,
    email: offerEmail,
    expiresAt: data.expiresAt,
    reservedOrderId: data.reservedOrderId || null,
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
