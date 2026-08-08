/**
 * TC-S Network Foundation — SAi UIM Circuit Breaker
 * Era 21.1: Economic Autonomy (Task 17)
 *
 * Lightweight circuit breaker / timeout wrapper for external SAi UIM
 * dependency (LifeLens / abundance analysis).
 *
 * States:
 *   CLOSED  — normal operation, requests pass through
 *   OPEN    — failure threshold exceeded; requests fail fast
 *   HALF    — recovery probe: one request is allowed through
 *
 * Configuration (conservative defaults):
 *   timeout:          5 000 ms
 *   failureThreshold: 5 failures before opening
 *   successThreshold: 2 successes before closing from HALF
 *   recoveryWindow:   30 000 ms before probe is allowed from OPEN
 *
 * If LifeLens/abundance analysis is non-essential to a transaction
 * (per current policy), transactions degrade gracefully rather than fail.
 */

'use strict';

const STATES = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF: 'HALF' });

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'unnamed';
    this.timeout = options.timeout || 5_000;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.recoveryWindow = options.recoveryWindow || 30_000;

    this._state = STATES.CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._lastFailureAt = null;
    this._lastAttemptAt = null;
  }

  get state() { return this._state; }

  _trip() {
    this._state = STATES.OPEN;
    this._lastFailureAt = Date.now();
    console.warn(`⚡ CircuitBreaker [${this.name}] OPENED after ${this._failures} failures`);
  }

  _reset() {
    this._state = STATES.CLOSED;
    this._failures = 0;
    this._successes = 0;
    console.log(`✅ CircuitBreaker [${this.name}] CLOSED (recovered)`);
  }

  _recordSuccess() {
    this._failures = 0;
    if (this._state === STATES.HALF) {
      this._successes += 1;
      if (this._successes >= this.successThreshold) this._reset();
    }
  }

  _recordFailure() {
    this._failures += 1;
    this._successes = 0;
    if (this._state === STATES.HALF || this._failures >= this.failureThreshold) {
      this._trip();
    }
  }

  /**
   * Execute fn() through the circuit breaker.
   * @param {Function} fn - async function returning a result
   * @param {*} fallback  - value to return when circuit is open or fn times out
   * @param {boolean} required - if true, throw instead of returning fallback
   */
  async call(fn, fallback = null, required = false) {
    this._lastAttemptAt = Date.now();

    // OPEN state: check if recovery window has elapsed
    if (this._state === STATES.OPEN) {
      const elapsed = Date.now() - (this._lastFailureAt || 0);
      if (elapsed < this.recoveryWindow) {
        const degraded = {
          _circuit_breaker: true,
          state: STATES.OPEN,
          name: this.name,
          degraded: true,
          reason: `Circuit open — last failure ${Math.round(elapsed / 1000)}s ago, recovery in ${Math.round((this.recoveryWindow - elapsed) / 1000)}s`,
        };
        if (required) throw Object.assign(new Error(degraded.reason), { circuitOpen: true });
        return fallback !== null ? fallback : degraded;
      }
      // Allow a probe
      this._state = STATES.HALF;
      this._successes = 0;
      console.log(`⚡ CircuitBreaker [${this.name}] HALF-OPEN probe`);
    }

    // Execute with timeout
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Circuit breaker timeout after ${this.timeout}ms`)), this.timeout)
        ),
      ]);
      this._recordSuccess();
      return result;
    } catch (err) {
      this._recordFailure();
      console.warn(`⚡ CircuitBreaker [${this.name}] failure #${this._failures}: ${err.message}`);
      if (required) throw err;
      return fallback !== null ? fallback : { _circuit_breaker: true, degraded: true, error: err.message };
    }
  }

  status() {
    return {
      name: this.name,
      state: this._state,
      failures: this._failures,
      successes: this._successes,
      lastFailureAt: this._lastFailureAt ? new Date(this._lastFailureAt).toISOString() : null,
      lastAttemptAt: this._lastAttemptAt ? new Date(this._lastAttemptAt).toISOString() : null,
      config: {
        timeout: this.timeout,
        failureThreshold: this.failureThreshold,
        successThreshold: this.successThreshold,
        recoveryWindow: this.recoveryWindow,
      },
    };
  }
}

// Singleton for the SAi UIM / LifeLens external dependency
const saiUimBreaker = new CircuitBreaker({
  name: 'sai-uim-lifelens',
  timeout: 5_000,
  failureThreshold: 5,
  successThreshold: 2,
  recoveryWindow: 30_000,
});

module.exports = { CircuitBreaker, saiUimBreaker };
