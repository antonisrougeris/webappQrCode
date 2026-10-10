import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";
import { normalizeUrlOrThrow } from "../utils/validators.js";

import QRCode from "qrcode";


export async function getQrCodesForUser(userId) {
  if (!userId) throw new ApiError(401, "Missing user id");

  const db = getDB();
  const snapshot = await db
    .collection(COLLECTIONS.QR_CODES)
    .where("userId", "==", userId)
    .get();
  const qrCodes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  qrCodes.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
  return qrCodes;
}

export async function updateQrCodeTarget({ userId, qrId, targetUrl }) {
  if (!userId) throw new ApiError(401, "Missing user id");
  if (!qrId) throw new ApiError(400, "Missing qr id");

  const normalizedTargetUrl = normalizeUrlOrThrow(targetUrl, "targetUrl");
  const db = getDB();
  const qrRef = db.collection(COLLECTIONS.QR_CODES).doc(qrId);
  const qrSnap = await qrRef.get();

  if (!qrSnap.exists) throw new ApiError(404, "QR code not found");

  const qrCode = { id: qrSnap.id, ...qrSnap.data() };
  if (qrCode.userId !== userId)
    throw new ApiError(403, "You do not have access to this QR code");

  const updatedAt = nowIso();
  // Preserve the photo: switching back to it does not require re-uploading.
  const updates = {
    destinationType: "link",
    linkUrl: normalizedTargetUrl,
    targetUrl: normalizedTargetUrl,
    updatedAt,
  };
  await qrRef.update(updates);
  return { ...qrCode, ...updates };
}

export async function activateQrPhotoForUser({ userId, qrId }) {
  if (!userId) throw new ApiError(401, "Missing user id");
  if (!qrId) throw new ApiError(400, "Missing qr id");
  const ref = getDB().collection(COLLECTIONS.QR_CODES).doc(qrId);
  return getDB().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, "QR code not found");
    const qr = snap.data();
    if (qr.userId !== userId) throw new ApiError(403, "You do not have access to this QR code");
    if (!qr.photo?.storagePath) throw new ApiError(400, "Upload a photo first");
    const updatedAt = nowIso();
    const updates = {
      destinationType: "photo",
      // Preserve the last working link for the legacy redirect function.
      targetUrl: qr.linkUrl || (qr.destinationType !== "photo" ? qr.targetUrl : "") || "https://skanare.com",
      updatedAt,
    };
    tx.update(ref, updates);
    return { id: snap.id, ...qr, ...updates };
  });
}


export async function generateQrBuffer(url) {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 1000,              // PRINT QUALITY
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}