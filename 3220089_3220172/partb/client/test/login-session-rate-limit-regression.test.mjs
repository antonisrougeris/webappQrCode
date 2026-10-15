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

test("Google sign-in does not discard a verified Firebase user on transient API failures", () => {
  assert.match(google, /browserLocalPersistence/);
  assert.match(google, /429\|502\|503\|504/);
  assert.match(google, /isTransientBackendError\(error\)/);
  assert.match(google, /if \(!isTransientBackendError\(error\)\)/);
});

test("overlapping cart reads are shared and mutations invalidate pending snapshots", () => {
  assert.match(cart, /let pendingCartRead: Promise<Cart> \| null = null/);
  assert.match(cart, /pendingCartRead = pending/);
  assert.match(cart, /function invalidatePendingCartRead/);
  assert.match(cart, /export async function addCartItem[\s\S]*?invalidatePendingCartRead\(\)/);
});
