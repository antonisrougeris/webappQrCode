"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const PHOTO_PREFIX = "qr-photos/";
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extractQrId(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  const id = parts[0] === "q" ? parts[1] : parts[0];
  if (!id || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return null;
  return id;
}

async function findQr(id) {
  const snapshot = await db.collection("qrCodes")
    .where("shortId", "==", id)
    .limit(1)
    .get();
  if (!snapshot.empty) return snapshot.docs[0];
  const oldDoc = await db.collection("qrCodes").doc(id).get();
  return oldDoc.exists ? oldDoc : null;
}

function isActivePhoto(qr) {
  return qr?.destinationType === "photo" &&
    Boolean(qr?.userId) &&
    qr?.status !== "returned" &&
    typeof qr?.photo?.storagePath === "string" &&
    qr.photo.storagePath.startsWith(PHOTO_PREFIX) &&
    SUPPORTED_IMAGE_TYPES.has(qr.photo.contentType);
}

function sendPhotoPage(res, id) {
  // The QR ID is strictly validated and percent-encoded before interpolation.
  const encoded = encodeURIComponent(id);
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  return res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>QR Photo · SKANARE</title>
<style>
html,body{margin:0;min-height:100%;background:#111;color:#fff}
body{min-height:100svh;display:grid;place-items:center}
img{display:block;max-width:100%;max-height:100svh;object-fit:contain}
</style></head><body><img alt="Shared QR photo" src="/photo/${encoded}"></body></html>`);
}

async function servePhoto(req, res, id) {
  const doc = await findQr(id);
  if (!doc || !isActivePhoto(doc.data())) {
    return res.status(404).send("Photo not found");
  }

  const { storagePath, contentType } = doc.data().photo;
  const file = admin.storage().bucket().file(storagePath);

  // Metadata check prevents content-type spoofing even if Firestore is modified.
  const [metadata] = await file.getMetadata();
  if (metadata.contentType !== contentType) {
    return res.status(404).send("Photo unavailable");
  }

  res.set({
    "Content-Type": contentType,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });

  const stream = file.createReadStream();
  stream.on("error", (error) => {
    console.error("QR photo stream failed", { id, message: error.message });
    if (!res.headersSent) res.status(500).send("Photo unavailable");
    else res.destroy(error);
  });
  return stream.pipe(res);
}

exports.redirectQr = onRequest(
  { region: "europe-west1", timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return res.status(405).send("Method not allowed");
      }

      // Internal image request. Does not count as an additional scan.
      // This path is handled only when the hosting rewrite exposes /photo/:id.
      const segments = String(req.path || "").split("/").filter(Boolean);
      if (segments[0] === "photo") {
        const id = extractQrId(segments.slice(1).join("/"));
        if (!id) return res.status(400).send("Missing QR ID");
        return servePhoto(req, res, id);
      }

      const id = extractQrId(req.path);
      if (!id) return res.status(400).send("Missing QR ID");

      const doc = await findQr(id);
      if (!doc) return res.status(404).send("QR not found");
      const qr = doc.data();

      if (qr.status === "returned") {
        return res.status(404).send("QR not available");
      }

      if (isActivePhoto(qr)) {
        // One increment per page scan; the image itself is not counted again.
        if (req.method === "GET") {
          await doc.ref.update({
            scans: admin.firestore.FieldValue.increment(1),
            lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        return sendPhotoPage(res, id);
      }

      // If a photo was selected but its storage metadata is invalid,
      // do not redirect to a stale or broken photo URL.
      if (qr.destinationType === "photo") {
        return res.status(404).send("Photo unavailable");
      }

      if (!qr.targetUrl) return res.status(404).send("Destination not found");
      if (req.method === "GET") {
        await doc.ref.update({
          scans: admin.firestore.FieldValue.increment(1),
          lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return res.redirect(302, qr.targetUrl);
    } catch (error) {
      console.error("redirectQr error", error);
      return res.status(500).send("Server error");
    }
  }
);
