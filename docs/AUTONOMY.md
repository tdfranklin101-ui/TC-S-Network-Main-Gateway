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
