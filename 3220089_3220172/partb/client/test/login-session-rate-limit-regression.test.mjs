import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync("src/pages/login/login.ts", "utf8");
const google = readFileSync("src/services/google-auth.ts", "utf8");
const cart = readFileSync("src/services/cart.ts", "utf8");

test("login uses persistent Firebase auth and blocks overlapping login methods", () => {
  assert.match(login, /browserLocalPersistence/);
  assert.match(login, /await setPersistence\(firebaseAuth, browserLocalPersistence\)/);
  assert.match(login, /if \(authInProgress\) return;/);
  assert.match(login, /setAuthInProgress\(true\)/);
  assert.match(login, /setAuthInProgress\(false\)/);
});

test("Google sign-in preserves Firebase identity even if backend profile sync fails", () => {
  assert.match(google, /browserLocalPersistence/);
  assert.match(google, /isTransientBackendError\(error\)/);
  assert.match(google, /const profile = await getMe\(\)/);
  assert.match(google, /profile\?\.uid === result\.user\.uid/);
  const syncStart = google.indexOf("const token = await result.user.getIdToken(true)");
  const syncEnd = google.indexOf("export function signInWithGoogleAccount", syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  assert.doesNotMatch(google.slice(syncStart, syncEnd), /signOut\(firebaseAuth\)/);
});

test("overlapping cart reads are shared and mutations invalidate pending snapshots", () => {
  assert.match(cart, /let pendingCartRead: Promise<Cart> \| null = null/);
  assert.match(cart, /pendingCartRead = pending/);
  assert.match(cart, /function invalidatePendingCartRead/);
  assert.match(cart, /export async function addCartItem[\s\S]*?invalidatePendingCartRead\(\)/);
});
