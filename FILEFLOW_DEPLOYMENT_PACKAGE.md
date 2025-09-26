# TC-S Network Foundation Digital Artifact Marketplace
## Complete FileFlow Deployment Package

### 🚀 **DEPLOYMENT INSTRUCTIONS FOR FILEFLOW**

**Target URL**: https://replit.com/@tdfranklin101/FileFlow?s=app

### **Step 1: Core Files to Transfer**
Copy these exact files from the current marketplace workspace:

**Main Application:**
- `main.js` (Express server - REQUIRED)
- `package.json` (Dependencies - REQUIRED)
- `.replit` (Configuration - REQUIRED)

**Server Services Directory:**
- `server/database.js` (PostgreSQL + Drizzle ORM)
- `server/ledger-service.js` (Solar transactions with Decimal.js)
- `server/ai-curator.js` (AI curation system)
- `server/auth-bridge.js` (Authentication bridge)
- `server/artifact-file-manager.js` (File management)

**Shared Schema:**
- `shared/schema.js` (Database schema and types)

**Frontend (Optional - create minimal if needed):**
- `public/index.html` (Marketplace UI)
- `public/style.css` (Marketplace styles)
- `public/script.js` (Frontend logic)

### **Step 2: Environment Variables Required**
Set these in FileFlow app secrets:
```
DATABASE_URL=[PostgreSQL connection string]
OPENAI_API_KEY=[OpenAI API key]
PGUSER=[Database user]
PGPASSWORD=[Database password]
PGHOST=[Database host]
PGPORT=[Database port]
PGDATABASE=[Database name]
```

### **Step 3: Installation Commands**
Run in FileFlow workspace:
```bash
npm install
node main.js
```

### **Step 4: Verification**
- App should start on port 3001
- Health check: GET /health
- Expected response: All services "active"

### **Step 5: New URL**
Once deployed in FileFlow:
**New Marketplace URL**: `https://fileflow--tdfranklin101.replit.app`

### **🔒 Security Features Applied:**
- ✅ Purchase endpoint authentication
- ✅ Server-side price verification
- ✅ User authorization checks
- ✅ Decimal.js monetary precision
- ✅ CORS protection

### **📊 System Status:**
- Database: PostgreSQL with Drizzle ORM
- Ledger: Solar token precision transactions
- AI: OpenAI GPT-4 curation
- Auth: Foundation app bridge
- Fee: 15% marketplace, 85% creator

**READY FOR PRODUCTION DEPLOYMENT** ✅