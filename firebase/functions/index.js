"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// The bucket shown by Firebase Storage for SKANARE is gs://qrcode-zxfxi9.
// A default bucket is NOT always available automatically in Cloud Functions v2.
// Keep this explicit and override via QR_PHOTO_STORAGE_BUCKET if it changes.
const PHOTO_STORAGE_BUCKET =
  process.env.QR_PHOTO_STORAGE_BUCKET || "qrcode-zxfxi9";

admin.initializeApp({ storageBucket: PHOTO_STORAGE_BUCKET });
const db = admin.firestore();

const { extractQrId, isActivePhoto } = require("./qr-photo-utils");

async function findQr(id) {
  const snapshot = await db.collection("qrCodes")
    .where("shortId", "==", id)
    .limit(1)
    .get();
  if (!snapshot.empty) return snapshot.docs[0];
  const oldDoc = await db.collection("qrCodes").doc(id).get();
  return oldDoc.exists ? oldDoc : null;
}

function sendPhotoPage(res) {
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
</style></head><body><img alt="Shared QR photo" src="?photo=1"></body></html>`);
}

async function servePhoto(req, res, id) {
  const doc = await findQr(id);
  if (!doc || !isActivePhoto(doc.data())) {
    return res.status(404).send("Photo not found");
  }

  const { storagePath, contentType } = doc.data().photo;

  try {
    // Use exactly the Storage bucket containing QR uploads, not the
    // potentially unset/mismatched Admin SDK default bucket.
    const file = admin.storage().bucket(PHOTO_STORAGE_BUCKET).file(storagePath);
    const [metadata] = await file.getMetadata();

    if (metadata.contentType !== contentType) {
      console.error("QR photo MIME mismatch", {
        qrId: id,
        actualContentType: metadata.contentType,
        expectedContentType: contentType,
      });
      return res.status(404).send("Photo unavailable");
    }

    // Uploaded images are at most 5 MB; buffering allows us to return an
    // actual 404/500 rather than a broken <img> after headers were sent.
    const [bytes] = await file.download();

    return res.status(200).set({
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    }).send(bytes);
  } catch (error) {
    const status = error?.code === 404 || error?.code === "404" ? 404 : 500;
    console.error("QR photo Storage read failed", {
      qrId: id,
      bucket: PHOTO_STORAGE_BUCKET,
      code: error?.code || null,
      message: error?.message || "Unknown Storage error",
    });
    return res.status(status).send("Photo temporarily unavailable");
  }
}

exports.redirectQr = onRequest(
  { region: "europe-west1", timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return res.status(405).send("Method not allowed");
      }

      // Same QR URL with ?photo=1 serves the image. No extra Hosting
      // rewrite is needed; it never increments the scan counter.
      const id = extractQrId(req.path);
      if (!id) return res.status(400).send("Missing QR ID");
      if (req.query.photo === "1") return servePhoto(req, res, id);

      const doc = await findQr(id);
      if (!doc) return res.status(404).send("QR not found");
      const qr = doc.data();

      if (isActivePhoto(qr)) {
        // One increment per page scan; the image itself is not counted again.
        if (req.method === "GET") {
          await doc.ref.update({
            scans: admin.firestore.FieldValue.increment(1),
            lastScannedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        return sendPhotoPage(res);
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
