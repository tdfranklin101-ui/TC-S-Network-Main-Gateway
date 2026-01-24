/**
 * TC-S Network Foundation - Agentic Security Module
 * Version: 1.0.0
 * 
 * Provides:
 * - Scoped admin keys with claims
 * - Intent logging for privileged operations
 * - Replay protection (X-Req-Id deduplication)
 * - Role-Based Access Control (RBAC)
 */

const crypto = require('crypto');

const ADMIN_KEY_SCOPES = {
  'actions.execute': ['ASSET.*', 'PRICE.*', 'ORDER.*', 'LEDGER.*', 'SETTLEMENT.*', 'MODERATION.*'],
  'actions.approve': ['*'],
  'actions.reject': ['*'],
  'settlement.run': ['SETTLEMENT.RUN', 'SETTLEMENT.PREVIEW'],
  'pricing.publish': ['PRICE.QUOTE', 'PRICE.PUBLISH'],
  'marketplace.manage': ['ASSET.*', 'LISTING.*', 'INVENTORY.*'],
  'orders.manage': ['ORDER.*', 'FULFILLMENT.*'],
  'ledger.read': ['LEDGER.QUERY'],
  'ledger.write': ['LEDGER.POST', 'LEDGER.ADJUST'],
  'scheduler.manage': ['SCHEDULER.*'],
  'admin.full': ['*']
};

const ROLES = {
  member: {
    description: 'Standard member - can browse, buy, view own orders',
    permissions: ['ORDER.CREATE', 'ORDER.VIEW_OWN', 'SEARCH.*', 'ASSET.VIEW']
  },
  seller: {
    description: 'Seller - can create assets, manage own listings',
    permissions: ['ASSET.CREATE', 'ASSET.ENRICH', 'PRICE.QUOTE', 'LISTING.PUBLISH_OWN', 'ORDER.VIEW_OWN', 'SEARCH.*']
  },
  staff: {
    description: 'Staff - can fulfill orders, verify pickups',
    permissions: ['ORDER.VIEW', 'FULFILLMENT.CONFIRM', 'INVENTORY.VIEW', 'MODERATION.FLAG']
  },
  commissioner_admin: {
    description: 'Commissioner admin - manages network pricing and listings',
    permissions: ['PRICE.*', 'LISTING.*', 'ASSET.*', 'MODERATION.*', 'ORDER.VIEW', 'INVENTORY.*', 'REPORT.VIEW']
  },
  tcs_admin: {
    description: 'TC-S admin - full system access including settlements',
    permissions: ['*']
  }
};

const ROUTE_PERMISSIONS = {
  '/api/agentic/marketplace/asset': { methods: ['POST'], requiredRoles: ['seller', 'commissioner_admin', 'tcs_admin'], action: 'ASSET.CREATE' },
  '/api/agentic/marketplace/enrich': { methods: ['POST'], requiredRoles: ['seller', 'commissioner_admin', 'tcs_admin'], action: 'ASSET.ENRICH' },
  '/api/agentic/marketplace/price/quote': { methods: ['POST'], requiredRoles: ['seller', 'commissioner_admin', 'tcs_admin'], action: 'PRICE.QUOTE' },
  '/api/agentic/marketplace/price/publish': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'PRICE.PUBLISH' },
  '/api/agentic/marketplace/list': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'LISTING.PUBLISH' },
  '/api/agentic/marketplace/order': { methods: ['POST'], requiredRoles: ['member', 'seller', 'staff', 'commissioner_admin', 'tcs_admin'], action: 'ORDER.CREATE' },
  '/api/agentic/marketplace/capture-payment': { methods: ['POST'], requiredRoles: ['member', 'seller', 'staff', 'commissioner_admin', 'tcs_admin'], action: 'ORDER.CAPTURE_PAYMENT' },
  '/api/agentic/marketplace/fulfill': { methods: ['POST'], requiredRoles: ['staff', 'commissioner_admin', 'tcs_admin'], action: 'FULFILLMENT.CONFIRM' },
  '/api/agentic/marketplace/ledger': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'LEDGER.POST' },
  '/api/agentic/marketplace/settlement': { methods: ['POST'], requiredRoles: ['tcs_admin'], action: 'SETTLEMENT.RUN' },
  '/api/agentic/action/approve': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'actions.approve' },
  '/api/agentic/action/reject': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'actions.reject' },
  '/api/agentic/action/execute': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'actions.execute' },
  '/api/agentic/actions/:id/approve': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'actions.approve' },
  '/api/agentic/actions/:id/reject': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'actions.reject' },
  '/api/agentic/actions/:id/execute': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'actions.execute' },
  '/api/agentic/scheduler/status': { methods: ['GET'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'SCHEDULER.STATUS' },
  '/api/agentic/scheduler/trigger': { methods: ['POST'], requiredRoles: ['tcs_admin'], action: 'SCHEDULER.TRIGGER' },
  '/api/audit': { methods: ['GET'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'AUDIT.VIEW' },
  '/api/admin/assets': { methods: ['GET'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'ASSET.VIEW_ADMIN' },
  '/api/admin/assets/:id/approve': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'ASSET.APPROVE' },
  '/api/admin/assets/:id/reject': { methods: ['POST'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'MODERATION.REJECT' },
  '/api/admin/settlements': { methods: ['GET'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'SETTLEMENT.VIEW' },
  '/api/admin/settlements/:id': { methods: ['GET'], requiredRoles: ['commissioner_admin', 'tcs_admin'], action: 'SETTLEMENT.VIEW' }
};

function matchRoutePermission(pathname, method) {
  for (const [route, perm] of Object.entries(ROUTE_PERMISSIONS)) {
    if (route === pathname && perm.methods.includes(method)) {
      return perm;
    }
    const regex = new RegExp('^' + route.replace(/:[^\/]+/g, '[^/]+') + '$');
    if (regex.test(pathname) && perm.methods.includes(method)) {
      return perm;
    }
  }
  return null;
}

const replayCache = new Map();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_REPLAY_CACHE_SIZE = 10000;

function cleanupReplayCache() {
  const now = Date.now();
  let deleted = 0;
  for (const [reqId, timestamp] of replayCache.entries()) {
    if (now - timestamp > REPLAY_WINDOW_MS) {
      replayCache.delete(reqId);
      deleted++;
    }
  }
  return deleted;
}

setInterval(cleanupReplayCache, 60000);

function checkReplayProtection(reqId, strict = false) {
  if (!reqId) {
    if (strict) {
      return { valid: false, error: 'X-Req-Id header required for privileged operations' };
    }
    return { valid: true, warning: 'No X-Req-Id provided - replay protection disabled for this request' };
  }

  if (replayCache.has(reqId)) {
    return { valid: false, error: 'Duplicate request ID rejected (replay protection)', reqId };
  }

  if (replayCache.size >= MAX_REPLAY_CACHE_SIZE) {
    cleanupReplayCache();
  }

  replayCache.set(reqId, Date.now());
  return { valid: true, reqId };
}

function parseAdminKeyClaims(adminKey) {
  if (!adminKey) return null;

  const masterKey = process.env.ADMIN_SECRET_KEY;
  if (adminKey === masterKey) {
    return { valid: true, scopes: ['admin.full'], userId: 'system-admin' };
  }

  const scopedKeyPattern = /^([a-zA-Z0-9_-]+):(.+)$/;
  const match = adminKey.match(scopedKeyPattern);
  
  if (match) {
    const [, scope, keyPart] = match;
    const expectedScopedKey = process.env[`ADMIN_KEY_${scope.toUpperCase().replace(/\./g, '_')}`];
    
    if (expectedScopedKey && keyPart === expectedScopedKey) {
      return { 
        valid: true, 
        scopes: [scope], 
        userId: `service-${scope}`,
        isScoped: true
      };
    }
  }

  return null;
}

function checkScopePermission(scopes, actionType) {
  if (!scopes || !actionType) return false;

  for (const scope of scopes) {
    if (scope === 'admin.full' || scope === '*') return true;

    const allowedActions = ADMIN_KEY_SCOPES[scope];
    if (!allowedActions) continue;

    for (const pattern of allowedActions) {
      if (pattern === '*') return true;
      if (pattern === actionType) return true;
      
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        if (actionType.startsWith(prefix + '.')) return true;
      }
    }
  }

  return false;
}

function checkRolePermission(role, actionType) {
  if (!role || !actionType) return false;

  const roleConfig = ROLES[role];
  if (!roleConfig) return false;

  for (const permission of roleConfig.permissions) {
    if (permission === '*') return true;
    if (permission === actionType) return true;
    
    if (permission.endsWith('.*')) {
      const prefix = permission.slice(0, -2);
      if (actionType.startsWith(prefix + '.')) return true;
    }
  }

  return false;
}

function getRoutePermissions(pathname, method) {
  const exact = ROUTE_PERMISSIONS[pathname];
  if (exact && exact.methods.includes(method)) {
    return exact;
  }
  return matchRoutePermission(pathname, method);
}

function hashPayload(payload) {
  if (!payload) return null;
  const str = JSON.stringify(payload);
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

class IntentLogger {
  constructor(pool) {
    this.pool = pool;
    this.buffer = [];
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  async log(entry) {
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      who: entry.userId || 'anonymous',
      role: entry.role || 'unknown',
      action_type: entry.actionType || entry.route,
      route: entry.route,
      method: entry.method || 'POST',
      req_id: entry.reqId || null,
      payload_hash: entry.payloadHash || null,
      ip: entry.ip || null,
      user_agent: entry.userAgent || null,
      success: entry.success !== false,
      error: entry.error || null,
      duration_ms: entry.durationMs || null,
      metadata: entry.metadata || {}
    };

    this.buffer.push(logEntry);

    if (this.buffer.length >= 50) {
      await this.flush();
    }

    return logEntry.id;
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      for (const entry of entries) {
        await this.pool.query(`
          INSERT INTO intent_log (
            id, timestamp, who, role, action_type, route, method,
            req_id, payload_hash, ip, user_agent, success, error,
            duration_ms, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          entry.id,
          entry.timestamp,
          entry.who,
          entry.role,
          entry.action_type,
          entry.route,
          entry.method,
          entry.req_id,
          entry.payload_hash,
          entry.ip,
          entry.user_agent,
          entry.success,
          entry.error,
          entry.duration_ms,
          JSON.stringify(entry.metadata)
        ]);
      }
    } catch (error) {
      console.error('Failed to flush intent logs:', error.message);
      console.log('Intent log entries (fallback):', JSON.stringify(entries, null, 2));
    }
  }

  async shutdown() {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}

let intentLoggerInstance = null;

function initializeIntentLogger(pool) {
  if (!intentLoggerInstance) {
    intentLoggerInstance = new IntentLogger(pool);
  }
  return intentLoggerInstance;
}

function getIntentLogger() {
  return intentLoggerInstance;
}

async function createIntentLogTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS intent_log (
      id VARCHAR(36) PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      who VARCHAR(255) NOT NULL,
      role VARCHAR(50),
      action_type VARCHAR(100),
      route VARCHAR(255),
      method VARCHAR(10),
      req_id VARCHAR(100),
      payload_hash VARCHAR(32),
      ip VARCHAR(45),
      user_agent TEXT,
      success BOOLEAN DEFAULT TRUE,
      error TEXT,
      duration_ms INTEGER,
      metadata JSONB DEFAULT '{}'
    );
    
    CREATE INDEX IF NOT EXISTS idx_intent_log_timestamp ON intent_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_intent_log_who ON intent_log(who);
    CREATE INDEX IF NOT EXISTS idx_intent_log_action_type ON intent_log(action_type);
    CREATE INDEX IF NOT EXISTS idx_intent_log_req_id ON intent_log(req_id);
  `);
  console.log('✅ Intent log table ready');
}

async function validateScopedAdminAccess(req, pool, requiredAction, options = {}) {
  const adminKey = req.headers['x-admin-key'];
  const sessionToken = req.headers['x-session-token'];
  const authHeader = req.headers['authorization'];
  const reqId = req.headers['x-req-id'];

  const strictReplay = options.strictReplay !== false;
  const replayCheck = checkReplayProtection(reqId, strictReplay);
  if (!replayCheck.valid) {
    return { valid: false, error: replayCheck.error, replayRejected: true };
  }

  if (adminKey) {
    const claims = parseAdminKeyClaims(adminKey);
    if (claims && claims.valid) {
      if (checkScopePermission(claims.scopes, requiredAction)) {
        return { 
          valid: true, 
          userId: claims.userId, 
          role: 'admin',
          scopes: claims.scopes,
          authMethod: 'admin-key',
          reqId: replayCheck.reqId
        };
      }
      return { 
        valid: false, 
        error: `Admin key lacks required scope for ${requiredAction}`,
        scopes: claims.scopes
      };
    }
  }

  const token = sessionToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
  
  if (token) {
    try {
      const result = await pool.query(
        `SELECT s.sess, m.id as user_id, m.username, m.role 
         FROM session s 
         LEFT JOIN members m ON (s.sess->>'userId')::int = m.id
         WHERE s.sid = $1 AND s.expire > NOW()`,
        [token]
      );
      
      if (result.rows.length > 0 && result.rows[0].user_id) {
        const member = result.rows[0];
        const role = member.role || 'member';
        
        if (checkRolePermission(role, requiredAction)) {
          return { 
            valid: true, 
            userId: member.user_id, 
            username: member.username,
            role,
            authMethod: 'session',
            reqId: replayCheck.reqId
          };
        }
        
        return { 
          valid: false, 
          error: `Role '${role}' lacks permission for ${requiredAction}`,
          role
        };
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }

  return { valid: false, error: 'Authentication required' };
}

module.exports = {
  ROLES,
  ADMIN_KEY_SCOPES,
  ROUTE_PERMISSIONS,
  checkReplayProtection,
  parseAdminKeyClaims,
  checkScopePermission,
  checkRolePermission,
  getRoutePermissions,
  hashPayload,
  IntentLogger,
  initializeIntentLogger,
  getIntentLogger,
  createIntentLogTable,
  validateScopedAdminAccess
};
