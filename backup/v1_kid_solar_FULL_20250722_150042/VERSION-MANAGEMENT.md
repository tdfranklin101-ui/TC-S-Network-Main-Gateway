# The Current-See Version Management

> Current Version: **v1.2.0 (Build 2025.04.24)**

This document explains how to use the version management tools for The Current-See application.

## Version Information

The version information is stored in the `APP_VERSION` object in `pure-deployment.js`, which includes:

- `version`: The semantic version number (e.g., "1.2.0")
- `build`: The build identifier (e.g., "2025.04.24")
- `name`: The full name of the application
- `features`: A list of feature flags

## Version Management Tools

### 1. Check Application Version

You can quickly check the current version and status of the application:

```bash
node check-version.js
```

This will display:
- Current version and build number
- Feature flags status
- OpenAI integration status
- Database connection status
- Deployed version (if available)

For more detailed information:

```bash
node check-status.js
```

### 2. Update Version Number

To update the application version:

```bash
node update-version.js <version> <build>
```

Examples:
```bash
# Update to version 1.2.1 with today's date as build
node update-version.js 1.2.1

# Update to version 1.3.0 with specific build number
node update-version.js 1.3.0 2025.05.01
```

### 3. Manage Feature Flags

You can enable or disable specific features:

```bash
node set-feature.js <feature> <true|false>
```

Available features:
- `solarClock`: Controls the Solar Generator clock functionality
- `database`: Controls database integration
- `openai`: Controls OpenAI AI assistant features
- `distributionSystem`: Controls the SOLAR distribution system

Examples:
```bash
# Disable OpenAI integration
node set-feature.js openai false

# Enable database feature
node set-feature.js database true
```

### 4. OpenAI Feature Toggle

The OpenAI integration has a dedicated toggle that controls the runtime behavior:

```bash
# Enable OpenAI features
node toggle-openai.js enable

# Disable OpenAI features
node toggle-openai.js disable
```

## API Endpoints

The application provides version information through API endpoints:

### Version Endpoint

```
GET /api/version
```

Response:
```json
{
  "version": "1.2.0",
  "build": "2025.04.24",
  "name": "The Current-See Pure Deployment Server",
  "features": {
    "solarClock": true,
    "database": true,
    "openai": true,
    "distributionSystem": true
  },
  "openaiEnabled": false,
  "dbConnected": true,
  "timestamp": "2025-04-24T20:49:10.244Z"
}
```

### Health Endpoint

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-04-24T20:46:24.070Z",
  "version": "1.2.0",
  "build": "2025.04.24",
  "name": "The Current-See Pure Deployment Server",
  "database": "connected",
  "membersCount": 16,
  "environment": "development",
  "usingCustomDbUrl": false,
  "openai": "available",
  "apiFeatures": {
    "ai": true,
    "solarClock": true,
    "members": true,
    "signup": true
  }
}
```

## Changelog

See `CHANGELOG.md` for a detailed history of changes to the application.

```bash
cat CHANGELOG.md
```

## Deployment

See `FINAL-DEPLOYMENT-GUIDE.md` for detailed deployment instructions.

---

© 2025 The Current-See PBC, Inc. All rights reserved.