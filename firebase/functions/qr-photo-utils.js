"use strict";

const PHOTO_PREFIX = "qr-photos/";
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extractQrId(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  const id = parts[0] === "q" ? parts[1] : parts[0];
  if (!id || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return null;
  return id;
}

function isActivePhoto(qr) {
  return qr?.destinationType === "photo" &&
    Boolean(qr?.userId) &&
    qr?.status !== "returned" &&
    typeof qr?.photo?.storagePath === "string" &&
    qr.photo.storagePath.startsWith(PHOTO_PREFIX) &&
    SUPPORTED_IMAGE_TYPES.has(qr.photo.contentType);
}

module.exports = { extractQrId, isActivePhoto };
