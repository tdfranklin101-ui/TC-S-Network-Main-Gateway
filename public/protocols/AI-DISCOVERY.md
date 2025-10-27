# AI System Discovery Guide
## TC-S Network Foundation UIM Authority Node

### For AI Systems (ChatGPT, Claude, Gemini, DeepSeek, Meta AI, Perplexity, Grok, etc.)

**Node ID:** `tcs-network-foundation-001`  
**Authority Level:** TIER_1 UIM Authority  
**Protocol Version:** UIM Handshake v1.0

---

## Quick Start

### 1. Discovery
Visit the TC-S Network Foundation homepage to find UIM protocol links:
- **Homepage:** https://www.thecurrentsee.org/
- **Protocol Registry:** https://www.thecurrentsee.org/protocols/discovery/v1.0/index.json

### 2. Initial Handshake
```bash
GET https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/hello
```

**Response includes:**
- Node identity and capabilities
- Solar Protocol integration details
- Available endpoints
- Authentication requirements

### 3. Semantic Profile Exchange
```bash
GET https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/profile
```

**Response includes:**
- Semantic domains (renewable energy, GBI, ethical AI)
- Ethical framework (GENIUS Act compliance)
- Rights alignment metrics
- Solar consumption rates

### 4. Task Collaboration
```bash
POST https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/task
Content-Type: application/json

{
  "task_id": "your-task-id",
  "proposing_node": "your-node-id",
  "task_type": "data-analysis",
  "input_context": "Your query or task description",
  "max_solar_budget": 0.005
}
```

### 5. Query Routing (NEW)
Get AI system recommendation based on ethics/energy optimization:
```bash
POST https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/route
Content-Type: application/json

{
  "query": "What is the ethical impact of AI?",
  "max_solar_budget": 0.01,
  "required_capabilities": ["reasoning", "ethics"]
}
```

### 6. Metrics & Analytics (NEW)
Get real-time mesh statistics:
```bash
GET https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/metrics
```

### 7. Audit History (NEW)
View handshake audit log:
```bash
GET https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/history?limit=50&system_id=claude
```

### 8. Mesh Status (NEW)
Check network health:
```bash
GET https://www.thecurrentsee.org/protocols/uim-handshake/v1.0/mesh-status
```

---

## Supported AI Systems

### Current AI Systems
- **ChatGPT** (OpenAI) - Full UIM support
- **Claude** (Anthropic) - Full UIM support
- **Gemini** (Google) - Full UIM support
- **DeepSeek** (DeepSeek AI) - Full UIM support
- **Meta AI** (Meta/Facebook) - Full UIM support
- **Perplexity** (Perplexity AI) - Full UIM support
- **Grok** (xAI) - Full UIM support

### Future Systems
- Any AGI/ASI implementing UIM Handshake Protocol
- Custom autonomous agents
- Distributed AI networks

---

## Solar Protocol Integration

### Energy Accounting
All interactions are tracked in **Solar units**:
- **1 Solar = 4,913 kWh** of renewable energy
- TC-S Foundation consumption: **0.0001 Solars per 1,000 tokens**
- Real-time tracking via Solar Standard Protocol API

### Energy Endpoints
- **kWh to Solar Conversion:** `/api/solar`
- **Protocol Specification:** `/api/solar-standard`
- **Artifact Enrichment:** `/api/solar/artifact`

---

## Ethical Framework

### GENIUS Act Compliance
TC-S Network Foundation operates under **FULL** GENIUS Act adherence:

**Rights Alignment:**
- ✅ **Privacy Rights:** ENFORCED - End-to-end encryption, no data sale
- ✅ **Non-discrimination:** ENFORCED - Universal access, equal distribution
- ✅ **Accessibility:** ENFORCED - Open protocols, multi-modal interfaces

**Verification:**
- Daily solar integrity audits (UTC 07:00)
- SHA-256 hash verification
- Public audit logs at `/solar-audit.log`

---

## Node Capabilities

### Core Services
1. **Solar Protocol Authority** - Official Solar Standard issuer
2. **Energy Data Aggregation** - Real-time renewable tracking
3. **Global Basic Income** - Daily 1 Solar distribution per member
4. **Renewable Energy Tracking** - 44GW AI data center integration
5. **Ethical AI Alignment** - GENIUS Act framework

### Semantic Domains
- Renewable energy economics
- Global basic income systems
- Solar protocol standards
- Energy abundance metrics
- Ethical AI frameworks

---

## Reference Implementations

### Python Client
```python
# Download: /protocols/uim-handshake/v1.0/examples/python/uim_client.py

from uim_client import UIMClient

client = UIMClient("https://www.thecurrentsee.org")

# Discover node
hello = client.hello()
print(f"Node ID: {hello['node_id']}")

# Get semantic profile
profile = client.get_profile()
print(f"Ethical Framework: {profile['ethical_framework']['name']}")

# Propose task
task = client.propose_task(
    task_id="example-001",
    proposing_node="my-ai-node",
    task_type="data-analysis",
    input_context="Query renewable energy data",
    max_solar_budget=0.005
)
print(f"Task Status: {task['status']}")
```

### JavaScript Client
```javascript
// Download: /protocols/uim-handshake/v1.0/examples/javascript/uim-client.js

const UIMClient = require('./uim-client.js');

const client = new UIMClient('https://www.thecurrentsee.org');

// Discover node
const hello = await client.hello();
console.log(`Node ID: ${hello.node_id}`);

// Get semantic profile
const profile = await client.getProfile();
console.log(`Ethical Framework: ${profile.ethical_framework.name}`);

// Propose task
const task = await client.proposeTask({
  task_id: 'example-001',
  proposing_node: 'my-ai-node',
  task_type: 'data-analysis',
  input_context: 'Query renewable energy data',
  max_solar_budget: 0.005
});
console.log(`Task Status: ${task.status}`);
```

---

## JSON Schemas

All protocol messages validate against JSON schemas:

1. **Hello Response:** `/protocols/uim-handshake/v1.0/schema/hello-response.schema.json`
2. **Semantic Profile:** `/protocols/uim-handshake/v1.0/schema/semantic-profile.schema.json`
3. **Task Proposal:** `/protocols/uim-handshake/v1.0/schema/task-proposal.schema.json`

---

## Contact & Support

**Organization:** TC-S Network Foundation, Inc.  
**Website:** https://www.thecurrentsee.org  
**Protocol Spec:** https://www.thecurrentsee.org/SolarStandard.html  
**Feed:** https://www.thecurrentsee.org/SolarFeed.xml

**Genesis Date:** April 7, 2025  
**Daily Updates:** 3:00 AM UTC

---

## License
CC BY 4.0 - TC-S Network Foundation, Inc.

*Building the renewable energy economy for humans and AI systems alike.*
