import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Replace only infrastructure imports, then execute the actual service module.
// No Firebase credentials or production account mutations are needed.
let lookup;
let calls;
globalThis.__checkoutTestAuth = { getUserByEmail: async email => {
  calls.push(email);
  return lookup(email);
} };
const source = readFileSync(new URL('../src/services/auth.service.js', import.meta.url), 'utf8')
  .replace(/import .*?from "\.\.\/config\/db.js";/, `const getAuthService = () => globalThis.__checkoutTestAuth;
    const getDB = () => { throw new Error('Lookup must never access Firestore'); };`)
  .replace(/import .*?from "\.\.\/constants\/collections.js";/, 'const COLLECTIONS = {};')
  .replace(/import .*?from "\.\.\/utils\/apiError.js";/, `class ApiError extends Error {
    constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
  }`);
const { accountExistsByEmail } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

for (const profile of ['present', 'missing']) {
  for (const account of ['present', 'missing']) {
    test(`Auth ${account}, Firestore profile ${profile}: Auth alone decides`, async () => {
      calls = [];
      lookup = () => {
        if (account === 'missing') throw { code: 'auth/user-not-found' };
        return { uid: 'fixture-user' };
      };
      assert.equal(await accountExistsByEmail('  Customer@Example.COM  '), account === 'present');
      assert.deepEqual(calls, ['customer@example.com']);
    });
  }
}
for (const email of ['', null, {}, 'invalid', 'a@@example.com', 'a b@example.com', 'a@example', 'a'.repeat(250) + '@example.com']) {
  test(`invalid email rejected before Firebase: ${JSON.stringify(email)}`, async () => {
    calls = [];
    await assert.rejects(accountExistsByEmail(email), { statusCode: 400 });
    assert.equal(calls.length, 0);
  });
}
for (const code of ['auth/internal-error', 'auth/insufficient-permission', 'ETIMEDOUT', 'unavailable']) {
  test(`lookup ${code} returns 503, never false`, async () => {
    calls = [];
    lookup = () => { throw { code }; };
    await assert.rejects(accountExistsByEmail('customer@example.com'), { statusCode: 503 });
  });
}
