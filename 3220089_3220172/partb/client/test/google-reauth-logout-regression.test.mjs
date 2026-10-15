import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const google = readFileSync("src/services/google-auth.ts", "utf8");
const main = readFileSync("src/main.ts", "utf8");

test("backend Google sync failure never signs out a successfully authenticated popup", () => {
  const start = google.indexOf("const token = await result.user.getIdToken(true)");
  const end = google.indexOf("\nexport function signInWithGoogleAccount", start);
  assert.ok(start >= 0 && end > start);
  const syncPath = google.slice(start, end);
  assert.doesNotMatch(syncPath, /signOut\(firebaseAuth\)/);
  assert.match(syncPath, /const profile = await getMe\(\)/);
  assert.match(syncPath, /profile\?\.uid === result\.user\.uid/);
  assert.match(syncPath, /firebaseAuth\.currentUser\?\.uid === result\.user\.uid/);
});

test("customer dashboard only applies results to their originating Firebase identity", () => {
  assert.match(main, /customerDashboardRevision === revision/);
  assert.match(main, /firebaseAuth\.currentUser\?\.uid === expectedUid/);
  assert.match(main, /if \(!isCurrentUser\(\)\) return;/);
});

test("API failures must not be treated as empty logged-in order history", () => {
  assert.match(main, /ordersResult\.status === "rejected"/);
  assert.match(main, /qrResult\.status === "rejected"/);
  assert.match(main, /!ordersFailed && !qrFailed/);
  assert.match(main, /Unable to load orders right now/);
});
