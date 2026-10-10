"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { extractQrId, isActivePhoto } = require("../qr-photo-utils");

test("supports short and legacy QR routes", () => {
  assert.equal(extractQrId("/abc123"), "abc123");
  assert.equal(extractQrId("/q/abc123"), "abc123");
  assert.equal(extractQrId("/"), null);
  assert.equal(extractQrId("/q/"), null);
  assert.equal(extractQrId("/../bad"), null);
});

test("only active owned image destinations can be served", () => {
  const photo = {
    destinationType: "photo",
    userId: "owner",
    status: "assigned",
    photo: { storagePath: "qr-photos/owner/qr1/abc.jpg", contentType: "image/jpeg" },
  };
  assert.equal(isActivePhoto(photo), true);
  assert.equal(isActivePhoto({ ...photo, status: "returned" }), false);
  assert.equal(isActivePhoto({ ...photo, userId: null }), false);
  assert.equal(isActivePhoto({ ...photo, destinationType: "link" }), false);
  assert.equal(isActivePhoto({ ...photo, photo: { ...photo.photo, contentType: "image/svg+xml" } }), false);
  assert.equal(isActivePhoto({ ...photo, photo: { ...photo.photo, storagePath: "other/private.jpg" } }), false);
});
