"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
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
