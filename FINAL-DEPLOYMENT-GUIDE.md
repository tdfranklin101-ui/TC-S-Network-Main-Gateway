# The Current-See Final Deployment Guide

This guide outlines the deployment process for The Current-See website.

> **Current Version: v1.2.0 (Build 2025.04.24)**
> 
> For a complete list of changes, refer to CHANGELOG.md

## Prerequisites

1. **Replit Account**: A Replit account with access to deployment features.
2. **Domain**: The domain `www.thecurrentsee.org` registered on Namecheap.
3. **PostgreSQL Database**: Access to the Neon PostgreSQL database with the connection string.
4. **OpenAI API Key**: (Optional) A valid OpenAI API key for AI assistant features.

## Deployment Steps

### 1. Environment Preparation

Set up the required environment variables:

- `CURRENTSEE_DB_URL`: The PostgreSQL database connection URL.
- `OPENAI_API_KEY`: (Optional) Your OpenAI API key - can be set in `.env.openai`.

### 2. Database Setup

The PostgreSQL database should include these tables:

- `members`: Stores member information.
- `distributions`: Tracks SOLAR token distributions.
- `analytics`: Stores analytics data.

### 3. Deployment Process

1. **Configure deployment settings** in the Replit interface:
   - Select "Deploy from GitHub" if using GitHub.
   - Or deploy directly from the Replit environment.

2. **Set up custom domain**:
   - Configure DNS settings at Namecheap:
     - Add a CNAME record for `www` pointing to your Replit subdomain.
     - Add an A record for the apex domain pointing to Replit's IP.
   - Verify domain ownership in Replit.

3. **Launch deployment**:
   - Use the `pure-deployment.js` script which is designed for production.
   - This script handles both static file serving and API endpoints.

### 4. Post-Deployment Configuration

1. **Database Connection**:
   - Verify database connection using `node check-status.js`.
   - Ensure the members table is properly loaded.

2. **OpenAI Integration**:
   - Set up OpenAI API key using `node update-openai-key.js`.
   - Enable features with `node toggle-openai.js enable`.
   - Test integration with `node test-openai-integration.js`.

## Server Architecture

The Current-See uses a layered architecture:

```
┌─────────────────────────────────────┐
│ Pure Deployment Server              │
├─────────────────────────────────────┤
│ Static File Serving                 │
│ API Endpoints                       │
│ Database Connection                 │
│ OpenAI Integration (with fallbacks) │
└─────────────────────────────────────┘
```

### Key Components

**1. Database Integration (`db.js`)**
- PostgreSQL connection using Neon Serverless
- Automatic retry and recovery mechanisms
- Member data management

**2. API Endpoints**
- `/api/solar-clock`: Real-time solar energy calculations
- `/api/members`: Member information
- `/api/signup`: New member registration
- `/api/ai/*`: AI assistant endpoints (with graceful degradation)

**3. OpenAI Integration**
- AI assistance for energy questions
- Product energy footprint analysis
- Graceful fallback mode when API is unavailable

## Graceful Degradation Strategy

The Current-See implements a comprehensive graceful degradation strategy:

1. **Database Connection**:
   - Automatic retry mechanism for database connections
   - Fallback to cached data when database is unavailable

2. **OpenAI Integration**:
   - Feature toggle system via `toggle-openai.js`
   - Automatic fallback to minimal service when API authentication fails
   - Friendly "in setup" messages instead of showing errors to users

3. **Static Content**:
   - Always available regardless of API status
   - Core functionality works without API dependencies

## Troubleshooting

### Database Connection Issues

1. **Verify connection string**:
   ```
   node check-currentsee-db.js
   ```

2. **Check status**:
   ```
   node check-status.js
   ```

3. **Reset database connection**:
   ```
   node deployment-db-fix.js
   ```

### OpenAI Integration Issues

1. **Check API key**:
   ```
   node test-openai-integration.js
   ```

2. **Update API key**:
   ```
   node update-openai-key.js
   ```

3. **Toggle features**:
   ```
   node toggle-openai.js enable
   node toggle-openai.js disable
   ```

4. **Diagnose problems**:
   ```
   node openai-key-diagnosis.js
   ```

## Monitoring and Maintenance

### Regular Health Checks

For a quick overview of version and status:
```
node check-version.js
```

For comprehensive status information:
```
node check-status.js
```

For a complete system check across all components:
```
node system-check.js

# For more detailed error information
node system-check.js --verbose
```

Or use the API endpoints directly:
```
curl https://www.thecurrentsee.org/health
curl https://www.thecurrentsee.org/api/version
curl https://www.thecurrentsee.org/api/database/status
```

### Version Management

The Current-See now includes comprehensive version tracking and management:

1. **Check current version**:
   ```
   curl https://www.thecurrentsee.org/api/version
   ```

2. **Update version number**:
   ```
   node update-version.js 1.2.1 2025.04.25
   ```

3. **Toggle features**:
   ```
   node set-feature.js openai true
   node set-feature.js database true
   ```

4. **View changelog**:
   ```
   cat CHANGELOG.md
   ```

For detailed instructions on version management, see:
```
cat VERSION-MANAGEMENT.md
```

### Database Backups

The system automatically exports member data to backup files daily.

### Error Logging

Error logs are stored in the server logs and can be viewed in the Replit console.

## Support

For additional support, contact:
- Technical Support: admin@thecurrentsee.org
- Domain Registration: Namecheap support
- Database Issues: Neon PostgreSQL support
- OpenAI API: OpenAI support portal

---

© 2025 The Current-See PBC, Inc. All rights reserved.