/**
 * TC-S Network Foundation — UIM Rate Limiter
 * Era 21.1: Economic Autonomy (Task 16)
 *
 * Scoped rate limiting for POST /api/uim/invoke.
 *
 * Limits (conservative):
 *   - Per agent (by agent_id):    20 requests per minute
 *   - Per session (anon callers): 10 requests per minute
 *   - Scheduler identity:         60 requests per hour (separate bucket)
 *
 * Internal scheduled jobs use the 'scheduler' bucket, which has a
 * higher-granularity hourly window rather than a per-minute window.
 *
 * Implementation: in-memory sliding window (no external dependency).
 * This is development-only — production should use Redis.
 */

'use strict';

const { SCHEDULER_AGENT_ID } = require('./agents/scheduler-agent');

// Configuration
const LIMITS = {
  agent:     { max: 20, windowMs: 60_000 },       // 20/min per agent_id
  session:   { max: 10, windowMs: 60_000 },       // 10/min per session
  scheduler: { max: 60, windowMs: 3_600_000 },    // 60/hr for scheduler
};

// In-memory store: key → sorted array of timestamps
const _windows = new Map();

/**
 * Check and record a request. Returns { allowed, remaining, resetMs }.
 * If not allowed, caller should return 429.
 */
function checkRateLimit(bucketKey, limitConfig) {
  const now = Date.now();
  const { max, windowMs } = limitConfig;

  if (!_windows.has(bucketKey)) _windows.set(bucketKey, []);
  const timestamps = _windows.get(bucketKey);

  // Evict entries outside the window
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0] <= cutoff) timestamps.shift();

  if (timestamps.length >= max) {
    const oldestInWindow = timestamps[0];
    const resetMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  timestamps.push(now);
  return { allowed: true, remaining: max - timestamps.length, resetMs: windowMs };
}

/**
 * Express-style middleware for /api/uim/invoke.
 * Reads agent_id from request body (parsed) or falls back to session key.
 *
 * Because main.js parses the body before calling this, we receive
 * the parsed body as req._parsedBody when wired through handleUimRoutes.
 * The UIM router passes agentId and sessionKey explicitly.
 */
function uimRateLimitCheck(agentId, sessionKey) {
  // Scheduler gets its own high-volume bucket
  if (agentId === SCHEDULER_AGENT_ID) {
    return checkRateLimit(`scheduler:${agentId}`, LIMITS.scheduler);
  }

  // Authenticated agent
  if (agentId) {
    return checkRateLimit(`agent:${agentId}`, LIMITS.agent);
  }

  // Session-based (admin sessions, etc.)
  const key = sessionKey || 'anon';
  return checkRateLimit(`session:${key}`, LIMITS.session);
}

/**
 * Purge stale buckets to prevent unbounded memory growth.
 * Safe to call periodically (e.g. every 10 minutes).
 */
function purgeStaleWindows() {
  const now = Date.now();
  const maxWindow = Math.max(...Object.values(LIMITS).map(l => l.windowMs));
  for (const [key, timestamps] of _windows) {
    const cutoff = now - maxWindow;
    while (timestamps.length > 0 && timestamps[0] <= cutoff) timestamps.shift();
    if (timestamps.length === 0) _windows.delete(key);
  }
}

// Purge every 10 minutes
setInterval(purgeStaleWindows, 600_000).unref();

module.exports = { uimRateLimitCheck, LIMITS };
