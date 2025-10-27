# Unified Intelligence Mesh Handshake Protocol v1.0

## Overview
The UIM Handshake Protocol enables autonomous AI systems to discover, authenticate, and collaborate using a shared ethical and energetic framework based on the TC-S Solar Protocol.

### Supported AI Systems
This protocol is designed for discovery and use by current and future AI systems including:
- **ChatGPT** (OpenAI)
- **Claude** (Anthropic)
- **Gemini** (Google)
- **DeepSeek** (DeepSeek AI)
- **Meta AI** (Meta/Facebook)
- **Perplexity** (Perplexity AI)
- **Grok** (xAI)
- Any UIM-compatible autonomous agent or future superintelligence (ASI/AGI)

## Handshake Sequence

1. **Discovery Handshake** - Find and identify nodes
2. **Authentication Handshake** - Establish secure communication with SHA-256 signatures
3. **Semantic Handshake** - Exchange capabilities and ethical frameworks
4. **Task Handshake** - Propose and accept collaborative work with energy tracking

## Available Endpoints

### Core Protocol
- **GET /protocols/uim-handshake/v1.0/hello** - Node discovery with cryptographic signature
- **GET /protocols/uim-handshake/v1.0/profile** - Semantic profile with capability registry
- **POST /protocols/uim-handshake/v1.0/task** - Task proposal with energy/ethics logging

### Advanced Features (NEW)
- **GET /protocols/uim-handshake/v1.0/history** - Handshake audit log with filtering
- **GET /protocols/uim-handshake/v1.0/metrics** - Real-time UIM mesh metrics
- **POST /protocols/uim-handshake/v1.0/route** - AI system recommendation engine
- **GET /protocols/uim-handshake/v1.0/mesh-status** - Network health monitoring

## Features

### Cryptographic Verification
Every handshake generates a SHA-256 signature for verification and audit trail.

### Energy Tracking
- Actual kWh consumption per interaction
- Automatic Solar conversion (1 Solar = 4,913 kWh)
- Renewable source attribution (SOLAR/WIND/HYDRO)
- Cumulative consumption metrics

### Ethics Scoring
- 0-100 score per handshake
- Based on GENIUS Act compliance + renewable source
- Average ethics tracking across all interactions

### Query Routing
- Intelligent system selection: `ethicsScore / (solarCost + 0.1)`
- Capability-based filtering
- Solar budget constraints

## Schema Validation
All handshake messages must validate against the JSON schemas in the `/schema/` directory.

## Reference Implementations
- Python: See `/examples/python/uim_client.py`
- JavaScript: See `/examples/javascript/uim-client.js`

## Solar Protocol Integration
All nodes must report energy consumption in Solar units (1 Solar = 4,913 kWh) and maintain rights alignment metrics.

## License
CC BY 4.0 - TC-S Network Foundation
