import test from "node:test";
import assert from "node:assert/strict";
import {
  cacheStorefrontRead,
  invalidateStorefrontReadCache,
} from "../src/services/storefront-read-cache.service.js";

test("idle: no Firestore reads without a request; concurrent requests share one read", async () => {
  invalidateStorefrontReadCache();
  let reads = 0;
  const read = async () => { reads += 1; return [{ id: "shirt" }]; };
  assert.equal(reads, 0);
  const results = await Promise.all(Array.from({ length: 50 }, () =>
    cacheStorefrontRead("catalog", 300_000, read)
  ));
  assert.equal(reads, 1);
  assert.equal(results.length, 50);
  await cacheStorefrontRead("catalog", 300_000, read);
  assert.equal(reads, 1);
  invalidateStorefrontReadCache();
});

test("explicit invalidation forces a fresh read and prevents old in-flight data from being cached", async () => {
  invalidateStorefrontReadCache();
  let resolveOld;
  const old = cacheStorefrontRead("stock", 300_000, () =>
    new Promise(resolve => { resolveOld = resolve; })
  );
  await Promise.resolve();
  invalidateStorefrontReadCache("stock");
  const fresh = await cacheStorefrontRead("stock", 300_000, async () => "fresh");
  assert.equal(fresh, "fresh");
  resolveOld("stale");
  assert.equal(await old, "stale");
  assert.equal(await cacheStorefrontRead("stock", 300_000, async () => "wrong"), "fresh");
  invalidateStorefrontReadCache();
});

test("failed read is not cached; next request retries", async () => {
  invalidateStorefrontReadCache();
  let calls = 0;
  await assert.rejects(cacheStorefrontRead("bad", 300_000, async () => {
    calls++;
    throw new Error("backend unavailable");
  }), /backend unavailable/);
  const value = await cacheStorefrontRead("bad", 300_000, async () => {
    calls++;
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(calls, 2);
  invalidateStorefrontReadCache();
});
