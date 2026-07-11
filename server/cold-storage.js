// Cold storage for marketplace artifact payloads.
//
// Artifact text (and other large inline content) is stored gzip-compressed in
// the private object-storage bucket and referenced from the database by a tiny
// `cold://<key>` pointer kept in the existing `content_body` column. This keeps
// database rows lightweight (transactional metadata + pointer only) so the
// platform's memory footprint stays flat as the catalog grows. Payloads are
// pulled only on demand (view/purchase) and warmed into the 24-hour working
// buffer for instant repeat access.

const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const objectStorage = require('./cloud-storage');
const workingBuffer = require('./working-buffer');

const COLD_PREFIX = 'cold://';
const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';

function isColdPointer(value) {
  return typeof value === 'string' && value.startsWith(COLD_PREFIX);
}

function keyFromPointer(pointer) {
  return isColdPointer(pointer) ? pointer.slice(COLD_PREFIX.length) : pointer;
}

function pointerFromKey(key) {
  return COLD_PREFIX + key;
}

// Store a text/JSON payload in cold storage. Returns a pointer descriptor, or
// null if object storage is unavailable (caller should fall back to inline).
async function putContent(content, format = 'text') {
  if (content == null) return null;
  if (!objectStorage.isAvailable()) return null;

  const raw = Buffer.from(String(content), 'utf8');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const ext = format === 'json' ? 'json' : 'txt';
  const key = `${PRIVATE_DIR}/cold/${hash}.${ext}.gz`;

  // Content-addressed dedupe: identical payloads are stored once.
  let exists = false;
  try {
    exists = await objectStorage.fileExists(key);
  } catch {
    exists = false;
  }
  if (!exists) {
    const compressed = await gzip(raw);
    await objectStorage.uploadFromBuffer(key, compressed);
  }

  // Warm the working buffer with the uncompressed payload.
  workingBuffer.set(key, raw);

  return { pointer: pointerFromKey(key), key, size: raw.length, hash };
}

// Read a payload back as a string. Accepts either a `cold://` pointer or a raw
// storage key. Serves from the 24-hour working buffer when warm.
async function getContent(pointerOrKey) {
  if (!pointerOrKey) return null;
  const key = keyFromPointer(pointerOrKey);

  const cached = workingBuffer.get(key);
  if (cached) return cached.toString('utf8');

  const compressed = await objectStorage.downloadFile(key);
  const raw = await gunzip(compressed);
  workingBuffer.set(key, raw);
  return raw.toString('utf8');
}

// Resolve a content_body value that may be inline text or a cold pointer.
// Inline values are returned as-is so read paths stay backward compatible.
async function resolveContentBody(value) {
  if (!isColdPointer(value)) return value;
  try {
    return await getContent(value);
  } catch (err) {
    console.warn('[ColdStorage] resolve failed for', value, '-', err.message);
    return null;
  }
}

module.exports = {
  COLD_PREFIX,
  isColdPointer,
  keyFromPointer,
  pointerFromKey,
  putContent,
  getContent,
  resolveContentBody,
  bufferStats: workingBuffer.stats,
};
