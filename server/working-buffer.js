// 24-hour working buffer: a size-bounded, TTL-based warm cache for artifact
// payloads that have been pulled out of cold storage in full. Keeps repeat
// views instant without re-fetching/decompressing, while a hard byte cap and
// LRU eviction guarantee it can never grow the platform's memory unbounded.

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_BYTES = (() => {
  const n = parseInt(process.env.WORKING_BUFFER_MAX_BYTES || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 64 * 1024 * 1024; // default 64 MB
})();

const TTL_MS = (() => {
  const n = parseInt(process.env.WORKING_BUFFER_TTL_MS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : DAY_MS; // default 24 hours
})();

// key -> { buf: Buffer, size: number, expires: number }
// Map preserves insertion order; we delete+reinsert on access to maintain LRU.
const store = new Map();
let totalBytes = 0;

function drop(key) {
  const e = store.get(key);
  if (!e) return;
  store.delete(key);
  totalBytes -= e.size;
}

function evictIfNeeded() {
  while (totalBytes > MAX_BYTES && store.size > 0) {
    const oldestKey = store.keys().next().value;
    drop(oldestKey);
  }
}

function get(key) {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    drop(key);
    return null;
  }
  // Refresh LRU recency.
  store.delete(key);
  store.set(key, e);
  return e.buf;
}

function set(key, buf) {
  if (!key) return;
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf.length > MAX_BYTES) return; // too large to ever hold
  drop(key); // replace any existing entry / reset recency
  const e = { buf, size: buf.length, expires: Date.now() + TTL_MS };
  store.set(key, e);
  totalBytes += buf.length;
  evictIfNeeded();
}

function has(key) {
  const e = store.get(key);
  if (!e) return false;
  if (Date.now() > e.expires) {
    drop(key);
    return false;
  }
  return true;
}

function stats() {
  return {
    entries: store.size,
    totalBytes,
    maxBytes: MAX_BYTES,
    ttlMs: TTL_MS,
    utilization: MAX_BYTES > 0 ? +(totalBytes / MAX_BYTES).toFixed(4) : 0,
  };
}

// Periodic sweep of expired entries so idle keys don't linger past 24h.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) {
    if (now > e.expires) drop(k);
  }
}, 60 * 60 * 1000);
if (typeof sweep.unref === 'function') sweep.unref();

module.exports = { get, set, has, stats };
