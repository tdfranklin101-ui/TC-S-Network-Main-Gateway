# TC-S Autonomy Spine v1

The Autonomy Spine is a policy-gated agentic framework that enables autonomous agents to operate within the TC-S Network Foundation platform with safe guardrails, audit logs, and deterministic execution.

## Core Principles

1. **Agents Never Mutate Core Directly** - All state changes go through the Action Gateway
2. **Human-in-the-Loop** - High-risk actions require human approval before execution
3. **Deterministic Policy** - All policy checks are rule-based (no AI/ML in the policy layer)
4. **Full Audit Trail** - Every action and state change is logged
5. **Idempotent Operations** - Actions can be safely retried without side effects

## ActionRequest Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │────►│  APPROVED   │────►│   RUNNING   │────►│  SUCCEEDED  │
│  (waiting   │     │  (ready to  │     │ (executing) │     │ (complete)  │
│  approval)  │     │   execute)  │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   │                   ▼
┌─────────────┐            │            ┌─────────────┐
│  REJECTED   │◄───────────┘            │   FAILED    │
│  (denied)   │                         │   (error)   │
└─────────────┘                         └─────────────┘
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `pending` | Action submitted, awaiting human approval |
| `approved` | Approved by admin, ready for execution |
| `running` | Currently executing (temporary state) |
| `succeeded` | Completed successfully with result |
| `failed` | Execution failed with error |
| `rejected` | Denied by admin with reason |

## API Reference

### Action Gateway Endpoints

#### Submit an Action
```http
POST /api/agentic/actions
Content-Type: application/json

{
  "actionType": "CREATE_NETWORK",
  "payload": { ... },
  "agentId": "commissioning-agent-v1",
  "idempotencyKey": "unique-key-123"
}
```

**Response:**
```json
{
  "success": true,
  "actionRequestId": "uuid",
  "status": "pending",
  "policySummary": { "checks": [...], "allowed": true }
}
```

#### Get Action Status
```http
GET /api/agentic/actions/:requestId
```

#### Approve Action (Admin)
```http
POST /api/agentic/actions/:requestId/approve
X-Admin: true
```

#### Execute Action (Admin)
```http
POST /api/agentic/actions/:requestId/execute
X-Admin: true
```

#### Reject Action (Admin)
```http
POST /api/agentic/actions/:requestId/reject
X-Admin: true
Content-Type: application/json

{
  "reason": "Does not meet requirements"
}
```

#### List Actions (Admin)
```http
GET /api/agentic/actions/list?limit=50&status=pending
X-Admin: true
```

### Legacy Endpoints (Backward Compatible)

These endpoints still work but internally use the Action Gateway:

- `POST /api/agentic/commissioning/create-direct` - Create network via Commissioning Agent
- `GET /api/agentic/action/status?requestId=xxx` - Check action status
- `POST /api/agentic/action/approve` - Approve action (body: `{requestId}`)
- `POST /api/agentic/action/execute` - Execute action (body: `{requestId}`)

## Policy Engine

The Policy Engine validates all action requests with deterministic rules:

### Policy Checks

1. **agent_authorization** - Is the agent registered and active?
2. **allowed_actions** - Is the agent allowed to perform this action type?
3. **risk_level** - Does the agent's max risk level cover this action?
4. **input_validation** - Does the payload match the required schema?
5. **rate_limit** - Is the agent within rate limits?
6. **business_rules** - Action-specific validation (e.g., network name uniqueness)

### Risk Levels

| Level | Examples | Approval Required |
|-------|----------|-------------------|
| `low` | Query operations | No |
| `medium` | Create network | Yes |
| `high` | Transfer Solar | Yes |
| `critical` | Delete network, Mint Solar | Yes + Multi-sig |

## Adding New Action Types

1. **Define the action** in `server/agentic/api-surface.js`:

```javascript
const ACTION_TYPES = {
  // ... existing actions
  MY_NEW_ACTION: {
    id: 'MY_NEW_ACTION',
    name: 'My New Action',
    description: 'What this action does',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: true,
    inputSchema: {
      myField: { type: 'string', required: true }
    }
  }
};
```

2. **Add business rules** in `server/agentic/policy.js`:

```javascript
if (actionRequest.actionType === 'MY_NEW_ACTION') {
  // Add validation logic
}
```

3. **Implement the executor** in `server/agentic/executor.js`:

```javascript
this.handlers['MY_NEW_ACTION'] = this.executeMyNewAction.bind(this);

async executeMyNewAction(payload, request) {
  // Implementation
  return { result: 'data' };
}
```

## Agent Development

### Registering an Agent

Agents are registered in the `agent_registry` table:

```sql
INSERT INTO agent_registry (id, agent_name, agent_type, allowed_actions, max_risk_level)
VALUES (
  'my-agent-v1',
  'My Custom Agent',
  'custom',
  '["MY_NEW_ACTION", "QUERY_NETWORK"]',
  'medium'
);
```

### Agent Best Practices

1. **Least Privilege** - Only request permissions your agent needs
2. **Idempotency Keys** - Always include unique keys for retry safety
3. **Error Handling** - Check response status and handle failures gracefully
4. **Audit Awareness** - All actions are logged; design accordingly

## Admin UI

Access the Admin Console at: `/admin-actions.html`

Features:
- View all pending, approved, and completed actions
- See policy check results for each action
- Approve or reject pending actions
- Execute approved actions
- Filter by status

## Testing

Run the smoke test to verify the action pipeline:

```bash
./scripts/smoke-actions.sh http://localhost:3002
```

The test covers:
1. Submit a network creation request
2. Verify pending status
3. Approve the action
4. Execute the action
5. Verify successful completion
6. Test invalid spec rejection

## Architecture Files

| File | Purpose |
|------|---------|
| `server/agentic/api-surface.js` | Action type definitions and schemas |
| `server/agentic/policy.js` | Deterministic policy engine |
| `server/agentic/executor.js` | Action execution handlers |
| `server/agentic/routes.js` | REST API endpoints |
| `server/agentic/agents/` | Agent implementations |
| `shared/schema.ts` | Database tables (action_requests, etc.) |

## Security

- Admin endpoints require `X-Admin: true` header
- High-risk actions require authenticated agent identity
- Multi-signature support for critical actions
- No secrets or PII in logs
- Safe error messages (no internal details exposed)

---

# Autonomy Spine v2 - Marketplace Operations

Version 2 extends the policy-gated framework with full marketplace support including asset management, rules-based pricing, order processing, ledger posting, and automated settlement.

## Marketplace Action Types (17 new operations)

### Asset Operations
| Action Type | Risk | Approval | Description |
|-------------|------|----------|-------------|
| `ASSET.CREATE` | low | auto | Create asset from user input (photos, description) |
| `ASSET.ENRICH` | low | auto | AI-powered enrichment (categorization, kWh estimate) |
| `ASSET.LIST` | low | admin | Publish asset to marketplace (requires price) |
| `ASSET.UNLIST` | low | admin | Remove from marketplace |
| `ASSET.UPDATE` | low | admin | Modify asset details or quantity |

### Pricing Operations
| Action Type | Risk | Approval | Description |
|-------------|------|----------|-------------|
| `PRICE.QUOTE` | low | auto | Generate price quote with fee breakdown |
| `PRICE.PUBLISH` | medium | admin | Set final price for asset |
| `PRICE.UPDATE_RULES` | high | admin | Modify network pricing rules |

### Order Operations
| Action Type | Risk | Approval | Description |
|-------------|------|----------|-------------|
| `ORDER.CREATE` | medium | auth | Create order with inventory reservation |
| `ORDER.CAPTURE_PAYMENT` | high | auth | Confirm payment receipt |
| `ORDER.FULFILL` | medium | admin | Mark order delivered |

### Ledger & Settlement
| Action Type | Risk | Approval | Description |
|-------------|------|----------|-------------|
| `LEDGER.POST` | high | admin | Append event to immutable ledger |
| `SETTLEMENT.RUN` | high | admin | Execute periodic settlement |

### Support Operations
| Action Type | Risk | Approval | Description |
|-------------|------|----------|-------------|
| `MODERATION.REVIEW` | low | auto | Content policy check |
| `SEARCH.FULFILLMENT.RECOMMEND` | low | auto | AI procurement recommendations |
| `ALERT.CREATE` | low | auto | System alerts and notifications |

## Marketplace API Endpoints

### Asset Creation
```http
POST /api/agentic/marketplace/asset
Content-Type: application/json

{
  "title": "Solar Panel 250W",
  "description": "Monocrystalline solar panel, excellent condition",
  "category": "energy_trading",
  "condition": "like_new",
  "quantity": 5,
  "imageUrls": ["https://..."],
  "tags": ["solar", "renewable", "energy"]
}
```

### Asset Enrichment
```http
POST /api/agentic/marketplace/enrich
Content-Type: application/json

{
  "assetId": "uuid",
  "forceRefresh": false
}
```

### Price Quote
```http
POST /api/agentic/marketplace/price/quote
Content-Type: application/json

{
  "assetId": "uuid",
  "networkId": "default"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "assetId": "uuid",
    "recommendedPrice": 12.50,
    "currency": "solar",
    "breakdown": {
      "vendorNet": 10.00,
      "commissionerFee": 1.25,
      "tcsFee": 0.25,
      "taxAmount": 1.00
    },
    "confidence": 85,
    "priceRange": { "min": 10.00, "max": 15.00 },
    "requiresApproval": false
  }
}
```

### Publish Price (Admin)
```http
POST /api/agentic/marketplace/price/publish
X-Session-Token: <admin-session-sid>
Content-Type: application/json

{
  "assetId": "uuid",
  "priceSolar": 12.50
}
```

**Alternative: Admin Secret Key (for service-to-service)**
```http
X-Admin: true
X-Admin-Key: <ADMIN_SECRET_KEY>
```

### List Asset (Admin)
```http
POST /api/agentic/marketplace/list
X-Session-Token: <admin-session-sid>
Content-Type: application/json

{
  "assetId": "uuid"
}
```

### Create Order (Auth Required)
```http
POST /api/agentic/marketplace/order
X-Session-Token: <valid-session-sid>
Content-Type: application/json

{
  "items": [
    { "assetId": "uuid", "quantity": 2 }
  ],
  "paymentMethod": "solar",
  "pickupPreference": "in_store"
}
```

**Alternative: Bearer Token**
```http
Authorization: Bearer <valid-session-sid>
```

**Response:**
```json
{
  "success": true,
  "result": {
    "orderId": "uuid",
    "status": "reserved",
    "totalSolar": 25.00,
    "verificationCode": "XYZ123",
    "reservationExpiry": "2024-01-01T12:30:00Z"
  }
}
```

### Capture Payment (Auth Required + Order Ownership)
```http
POST /api/agentic/marketplace/capture-payment
X-Session-Token: <valid-session-sid>
Content-Type: application/json

{
  "orderId": "uuid",
  "paymentIntentId": "pi_xxx",
  "solarAmount": 25.00
}
```

### Fulfill Order (Admin)
```http
POST /api/agentic/marketplace/fulfill
X-Session-Token: <admin-session-sid>
Content-Type: application/json

{
  "orderId": "uuid",
  "verificationMethod": "qr",
  "verificationCode": "XYZ123",
  "staffId": "staff-123"
}
```

### Post Ledger Entry (Admin)
```http
POST /api/agentic/marketplace/ledger
X-Session-Token: <admin-session-sid>
Content-Type: application/json

{
  "eventType": "adjustment",
  "orderId": "uuid",
  "amount": 5.00,
  "currency": "solar",
  "description": "Refund for damaged item"
}
```

### Run Settlement (Admin)
```http
POST /api/agentic/marketplace/settlement
X-Session-Token: <admin-session-sid>
Content-Type: application/json

{
  "networkId": "default",
  "periodStart": "2024-01-01T00:00:00Z",
  "periodEnd": "2024-01-31T23:59:59Z",
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "settlementId": "uuid",
    "ordersSettled": 42,
    "totalVolume": 1250.00,
    "splits": {
      "vendors": 1000.00,
      "commissioner": 125.00,
      "tcs": 25.00,
      "taxBucket": 100.00
    }
  }
}
```

## Pricing Engine

### Default Fee Structure
| Fee Type | Rate | Description |
|----------|------|-------------|
| Commissioner Margin | 10% | Network operator fee |
| TC-S Foundation | 2% | Platform fee |
| Tax Rate | 8% | Configurable per network |
| Vendor Net | 80% | Amount paid to seller |

### Configuration (per network)
```json
{
  "networkId": "default",
  "commissionerMargin": 0.10,
  "tcsMargin": 0.02,
  "taxRate": 0.08,
  "taxInclusive": true,
  "currency": "solar"
}
```

### Confidence Scoring
- **High (>80%)**: Auto-approved, comparable items found
- **Medium (50-80%)**: Recommended for review
- **Low (<50%)**: Requires manual pricing

## Database Schema (v2 additions)

| Table | Purpose |
|-------|---------|
| `inventory` | Asset stock tracking (total, available, reserved) |
| `orders` | Order records with status tracking |
| `order_items` | Line items per order |
| `ledger_events` | Append-only financial ledger |
| `settlements` | Settlement run records |
| `network_config` | Network-specific pricing rules |

## Agent Registry

| Agent ID | Type | Risk Level | Permissions |
|----------|------|------------|-------------|
| `marketplace-agent-v1` | marketplace | medium | ASSET.*, MODERATION.*, SEARCH.* |
| `pricing-agent-v1` | pricing | medium | PRICE.* |
| `order-agent-v1` | orders | high | ORDER.CREATE, ORDER.CAPTURE_PAYMENT |
| `fulfillment-agent-v1` | fulfillment | medium | ORDER.FULFILL, LEDGER.POST |
| `settlement-agent-v1` | settlement | high | SETTLEMENT.RUN, LEDGER.POST |

## Key Invariants

1. **Inventory integrity**: Changes only via ORDER actions
2. **Price immutability**: Published prices only changed via PRICE.PUBLISH
3. **Append-only ledger**: LEDGER.POST creates immutable entries
4. **Reservation expiry**: 30-minute hold with automatic release
5. **Settlement splits**: Vendor/commissioner/TC-S/tax tracked separately

## Architecture Files (v2)

| File | Purpose |
|------|---------|
| `server/agentic/pricing-engine.js` | Pricing calculations and fee splits |
| `server/agentic/handlers/marketplace-handlers.js` | Marketplace action handlers |
| `server/agentic/security.js` | Scoped admin keys, intent logging, RBAC |
| `server/agentic/scheduler.js` | Daily schedulers for settlements and reports |
| `scripts/golden-path-test.js` | End-to-end smoke test script |

## Security Features (v2.1)

### Scoped Admin Keys
Admin keys can be scoped to specific operations:
```
X-Admin-Key: actions.execute:<KEY>   # Can execute actions
X-Admin-Key: settlement.run:<KEY>    # Can run settlements only
X-Admin-Key: pricing.publish:<KEY>   # Can publish prices only
```

### Intent Logging
All privileged operations log:
- `who`: User ID or service identity
- `action_type`: Operation type (e.g., SETTLEMENT.RUN)
- `route`: API endpoint
- `req_id`: Request ID for correlation
- `payload_hash`: SHA-256 hash of request body
- `timestamp`: When the operation occurred

### Replay Protection
Set `X-Req-Id` header on privileged requests. Duplicate IDs within 5 minutes are rejected:
```http
POST /api/agentic/marketplace/settlement
X-Req-Id: unique-request-id-123
X-Session-Token: <admin-session>
```

### RBAC Roles
| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `member` | Standard user | ORDER.CREATE, SEARCH.* |
| `seller` | Can create listings | ASSET.CREATE, PRICE.QUOTE |
| `staff` | Can fulfill orders | FULFILLMENT.CONFIRM |
| `commissioner_admin` | Network operator | PRICE.*, LISTING.*, MODERATION.* |
| `tcs_admin` | Full system access | *.* (all operations) |

## Scheduler Operations

### Daily Jobs
| Job Type | Schedule | Description |
|----------|----------|-------------|
| `settlement.daily` | 2:00 AM | Auto-run previous day's settlement |
| `report.daily` | 3:00 AM | Generate daily activity report |
| `risk.scan` | Hourly | Scan for suspicious activity |
| `inventory.audit` | Weekly | Check inventory discrepancies |
| `session.cleanup` | Daily | Remove expired sessions |

### Scheduler API

**Get scheduler status**
```http
GET /api/agentic/scheduler/status
X-Session-Token: <admin-session>
```

**Trigger job manually**
```http
POST /api/agentic/scheduler/trigger
X-Session-Token: <admin-session>
Content-Type: application/json

{
  "jobType": "settlement.daily"
}
```

**List job types**
```http
GET /api/agentic/scheduler/job-types
```

## Security Hardening

### Scoped Admin Keys
All privileged operations require a scoped admin key with appropriate permissions:

| Scope | Allowed Actions |
|-------|-----------------|
| `actions.execute` | ASSET.*, PRICE.*, ORDER.*, LEDGER.*, SETTLEMENT.*, MODERATION.* |
| `actions.approve` | All action approvals |
| `actions.reject` | All action rejections |
| `settlement.run` | SETTLEMENT.RUN, SETTLEMENT.PREVIEW |
| `pricing.publish` | PRICE.QUOTE, PRICE.PUBLISH |
| `scheduler.manage` | SCHEDULER.* |
| `admin.full` | All operations |

### Replay Protection
All privileged endpoints require `X-Req-Id` header:
```http
POST /api/agentic/actions/:id/approve
X-Req-Id: unique-uuid-per-request
X-Admin-Key: scoped-key
```

Duplicate request IDs within 5 minutes are rejected.

### Intent Logging
All privileged operations are logged with:
- User ID and role
- Action type and route
- Request ID for correlation
- Payload hash (SHA-256)
- Timestamp and duration
- Success/error status

### RBAC Enforcement
Routes enforce role-based access control via `validateWithRBAC`:
```javascript
const scopedAuth = await validateWithRBAC(req, pool, 'actions.approve');
if (!scopedAuth.valid) {
  return 403; // Role or scope insufficient
}
```

## Golden Path Test

Run the end-to-end smoke test:
```bash
node scripts/golden-path-test.js
```

Tests the complete flow:
1. ASSET.CREATE → 2. ASSET.ENRICH → 3. PRICE.QUOTE → 4. PRICE.PUBLISH
5. LISTING.PUBLISH → 6. ORDER.CREATE → 7. PAYMENT.CAPTURE
8. FULFILLMENT.CONFIRM → 9. LEDGER.POST → 10. SETTLEMENT.RUN
