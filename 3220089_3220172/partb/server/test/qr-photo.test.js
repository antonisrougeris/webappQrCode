import test from "node:test";
import assert from "node:assert/strict";
import {
  detectQrPhotoMime,
  assertPhotoFile,
  assertPublicQrId,
  qrPhotoViewerUrl,
} from "../src/services/qr-photo.service.js";

test("recognizes JPEG, PNG and WebP binary headers", () => {
  assert.equal(detectQrPhotoMime(Buffer.from([255,216,255,224,...Array(20).fill(0)]))?.contentType, "image/jpeg");
  assert.equal(detectQrPhotoMime(Buffer.from([137,80,78,71,13,10,26,10,...Array(12).fill(0)]))?.contentType, "image/png");
  assert.equal(detectQrPhotoMime(Buffer.from("RIFF0000WEBP000000000"))?.contentType, "image/webp");
});

test("rejects invalid types, spoofed MIME and oversized files", () => {
  assert.throws(() => assertPhotoFile({buffer:Buffer.from("<svg>bad</svg>"),size:14,mimetype:"image/svg+xml"}));
  assert.throws(() => assertPhotoFile({buffer:Buffer.from([255,216,255,224,...Array(20).fill(0)]),size:24,mimetype:"image/png"}));
  assert.throws(() => assertPhotoFile({buffer:Buffer.alloc(5*1024*1024+1),size:5*1024*1024+1,mimetype:"image/jpeg"}));
});

test("public ID only allows safe short IDs", () => {
  assert.equal(assertPublicQrId("abc-123_QR"), "abc-123_QR");
  assert.throws(() => assertPublicQrId("../unsafe"));
});

test("photo viewer URL is stable", () => {
  assert.match(qrPhotoViewerUrl("123ab"), /\/api\/qr-photo\/view\/123ab$/);
});
