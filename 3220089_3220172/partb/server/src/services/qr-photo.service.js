import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";

export const QR_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const QR_PHOTO_PREFIX = "qr-photos/";
const PUBLIC_BASE = () => String(
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://skanare.com"
).replace(/\/+$/, "");

export function qrPhotoViewerUrl(publicId) {
  return `${PUBLIC_BASE()}/api/qr-photo/view/${encodeURIComponent(publicId)}`;
}

export function detectQrPhotoMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null; // SVG/GIF/HTML and unknown formats are intentionally rejected.
}

export function assertPhotoFile(file) {
  if (!file?.buffer || file.size < 16 || file.size > QR_PHOTO_MAX_BYTES) {
    throw new ApiError(400, "Select a photo smaller than 5 MB.");
  }
  const detected = detectQrPhotoMime(file.buffer);
  if (!detected || detected.contentType !== file.mimetype) {
    throw new ApiError(400, "Only genuine JPEG, PNG or WebP photos are supported.");
  }
  return detected;
}

export function assertPublicQrId(value) {
  const id = String(value || "");
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw new ApiError(404, "QR code not found");
  }
  return id;
}

export async function findPublicQrPhoto(publicId) {
  const id = assertPublicQrId(publicId);
  const collection = getDB().collection(COLLECTIONS.QR_CODES);
  const matches = await collection.where("shortId", "==", id).limit(1).get();
  const snap = matches.empty ? await collection.doc(id).get() : matches.docs[0];

  if (!snap.exists) throw new ApiError(404, "QR code not found");
  const qr = snap.data();
  const path = qr?.photo?.storagePath;
  if (qr?.destinationType !== "photo" ||
      typeof path !== "string" || !path.startsWith(QR_PHOTO_PREFIX)) {
    throw new ApiError(404, "Photo not found");
  }
  return { id: snap.id, ...qr };
}

export async function uploadQrPhotoForUser({ userId, qrId, file }) {
  if (!userId) throw new ApiError(401, "Sign in to update your QR code");
  const id = assertPublicQrId(qrId);
  const detected = assertPhotoFile(file);
  const db = getDB();
  const qrRef = db.collection(COLLECTIONS.QR_CODES).doc(id);
  const original = await qrRef.get();
  if (!original.exists) throw new ApiError(404, "QR code not found");
  if (original.data()?.userId !== userId) {
    throw new ApiError(403, "You do not have access to this QR code");
  }

  const storagePath = `${QR_PHOTO_PREFIX}${userId}/${id}/${randomUUID()}.${detected.extension}`;
  const bucket = getStorage().bucket();
  const object = bucket.file(storagePath);

  await object.save(file.buffer, {
    resumable: false,
    validation: "crc32c",
    contentType: detected.contentType,
    metadata: {
      cacheControl: "private, no-store, max-age=0",
      contentDisposition: "inline",
    },
  });

  let oldPath = null;
  let qrCode;
  try {
    qrCode = await db.runTransaction(async (tx) => {
      const latest = await tx.get(qrRef);
      if (!latest.exists) throw new ApiError(404, "QR code not found");
      const qr = latest.data();
      if (qr.userId !== userId) {
        throw new ApiError(403, "You do not have access to this QR code");
      }
      oldPath = qr.photo?.storagePath || null;
      const updatedAt = nowIso();
      const publicId = qr.shortId || latest.id;
      const linkUrl = qr.linkUrl ||
        (qr.destinationType !== "photo" ? qr.targetUrl : "") ||
        "https://skanare.com";
      const updates = {
        destinationType: "photo",
        linkUrl,
        targetUrl: qrPhotoViewerUrl(publicId),
        photo: {
          storagePath,
          contentType: detected.contentType,
          sizeBytes: file.size,
          updatedAt,
        },
        updatedAt,
      };
      tx.update(qrRef, updates);
      return { id: latest.id, ...qr, ...updates };
    });
  } catch (error) {
    await object.delete().catch(() => {});
    throw error;
  }

  // Keep the preceding photo until the DB transaction succeeds.
  if (oldPath && oldPath !== storagePath && oldPath.startsWith(QR_PHOTO_PREFIX)) {
    await bucket.file(oldPath).delete().catch((error) =>
      console.warn("Old QR photo cleanup failed", { qrId: id, message: error.message })
    );
  }
  return qrCode;
}

export async function getQrPhotoStream(publicId) {
  const qr = await findPublicQrPhoto(publicId);
  const path = qr.photo.storagePath;
  const type = qr.photo.contentType;
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    throw new ApiError(404, "Photo not found");
  }
  return { stream: getStorage().bucket().file(path).createReadStream(), contentType: type };
}
