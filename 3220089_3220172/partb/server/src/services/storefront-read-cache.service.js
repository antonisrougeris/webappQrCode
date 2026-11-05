// Demand-driven Firestore read-through cache: no background timers or polling.
// Concurrent identical requests share one promise; failed reads are never cached.
// Invalidation prevents an in-flight response from replacing newer data.
const entries = new Map();

export function cacheStorefrontRead(key, maxAgeMs, read) {
  const now = Date.now();
  const previous = entries.get(key);
  if (previous?.expiresAt > now) return Promise.resolve(previous.value);
  if (previous?.pending) return previous.pending;

  const entry = { pending: null, expiresAt: 0, value: undefined };
  const pending = Promise.resolve().then(read).then(
    (value) => {
      if (entries.get(key) === entry) {
        entries.set(key, { value, expiresAt: Date.now() + maxAgeMs });
      }
      return value;
    },
    (error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    }
  );
  entry.pending = pending;
  entries.set(key, entry);
  return pending;
}

export function invalidateStorefrontReadCache(...keys) {
  if (!keys.length) {
    entries.clear();
    return;
  }
  for (const key of keys) entries.delete(key);
}
