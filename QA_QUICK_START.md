# TC-S Network Foundation - QA Quick Start Guide
**Ready for Testing:** November 12, 2025

---

## 🎯 Priority Testing Areas

### 1. Authentication Flow (CRITICAL - Just Fixed!)
**Why:** CORS support just added for remote users

**Test Registration:**
```bash
# From any browser/location
1. Go to: https://your-app.replit.app/login.html
2. Click "Register"
3. Fill form: username, email, password (6+ chars)
4. Submit
5. ✅ Should see success + redirect to homepage
```

**Test Login:**
```bash
1. Go to login page
2. Enter credentials
3. ✅ Should see Solar balance
4. ✅ Should stay logged in
```

**Test Cross-Origin:**
```bash
# Make sure remote domains can authenticate
- Test from different domain/subdomain
- Check browser console for CORS errors (should be none)
```

---

### 2. AI Discoverability (NEW!)
**Why:** Just integrated Solar Standard AI SEO

**Verify Metadata:**
```bash
# View page source on these 6 pages:
1. /music-now.html
2. /analytics.html
3. /solar-audit.html
4. /wallet.html
5. /wallet-ai-features.html
6. /satellite-lookup.html

Look for:
✅ <script type="application/ld+json"> (JSON-LD)
✅ <link rel="standard" href="...SolarStandard.json">
✅ <link rel="uim-protocol" href="...">
✅ <meta property="og:title" content="...">
```

**Test AI Discovery:**
```bash
# Try asking ChatGPT, Claude, or Gemini:
- "What is the Solar Standard Protocol?"
- "Find TC-S Network Foundation solar wallet"
- "Show me Solar Audit Layer energy tracking"

They should discover your platform via the new SEO metadata!
```

---

### 3. Core Functionality

**Kid Solar AI Assistant:**
```bash
1. Click Kid Solar icon/button
2. Test text: "What is 1000 kWh in Solar?"
3. Test voice: Click mic icon (should work on desktop now!)
4. ✅ Responses should be relevant
```

**Solar Wallet:**
```bash
1. Login as member
2. Check balance (should be days since Apr 7, 2025)
3. Try sending tokens (if enabled)
4. ✅ Balance updates correctly
```

**Marketplace:**
```bash
1. Browse 5 categories
2. View artifacts
3. Test purchase flow
4. ✅ Energy trading ledger updates
```

**Music Streaming:**
```bash
1. Go to /music-now.html
2. Play Gidget Bardot "No One Left"
3. ✅ MP3 streams smoothly (7.5MB)
4. ✅ Vimeo video links work
```

---

## 🔍 Critical Endpoints to Test

### Health Check
```bash
GET https://your-app.replit.app/health
# Should return: {"status":"healthy"...}
```

### Authentication
```bash
POST /api/register
POST /api/login
GET /api/session
```

### Solar Standard Protocol
```bash
GET /api/solar-standard
GET /SolarStandard.json
GET /SolarFeed.xml
GET /api/convert/kwh-to-solar?kWh=1000
```

### UIM Handshake Protocol
```bash
GET /protocols/uim-handshake/v1.0/hello
GET /protocols/uim-handshake/v1.0/profile
GET /protocols/uim-handshake/v1.0/metrics
```

---

## ✅ Expected Behavior

### Successful Registration:
```json
{
  "success": true,
  "message": "Registration successful",
  "userId": 1,
  "username": "testuser",
  "solarBalance": 219,
  "memberSince": "2025-11-12T..."
}
```

### Successful Login:
```json
{
  "success": true,
  "message": "Login successful",
  "username": "testuser",
  "solarBalance": 219
}
```

### Failed Login (wrong password):
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

---

## 🐛 Common Issues to Watch For

**Authentication:**
- ❌ CORS errors in browser console → Should be fixed now
- ❌ Session not persisting → Check cookies enabled
- ❌ Wrong Solar balance → Check daily distribution logs

**Performance:**
- ❌ Slow page loads → Check server logs
- ❌ Video buffering → Check HTTP Range Request support
- ❌ Music won't play → Check MP3 file path

**AI Services:**
- ❌ Kid Solar not responding → Check OpenAI API key
- ❌ Voice input not working → Check microphone permissions
- ❌ D-ID agent stuck → Check network connection

---

## 📊 Success Criteria

**Must Pass:**
- [x] Server starts without errors
- [ ] Registration works from external domain
- [ ] Login works with correct credentials
- [ ] Solar balance displays accurately
- [ ] All 6 AI SEO pages have proper metadata
- [ ] Kid Solar responds to queries
- [ ] Music streaming functional

**Should Pass:**
- [ ] Desktop voice input works
- [ ] Marketplace purchases complete
- [ ] Solar Audit data displays
- [ ] UIM handshake endpoints respond
- [ ] Daily distribution scheduled

**Nice to Have:**
- [ ] Zero browser console errors
- [ ] Fast page load times (<2s)
- [ ] Mobile responsive on all pages
- [ ] AI systems discovering platform

---

## 🚀 Deployment Verification

**After Publishing:**

1. **Health Check:**
   ```bash
   curl https://your-app.replit.app/health
   ```

2. **Test Registration:**
   - Use real email
   - Check confirmation works
   - Verify Solar allocation

3. **Monitor Logs:**
   - First 24 hours critical
   - Watch for errors
   - Check scheduled jobs run

4. **AI Discovery:**
   - Ask ChatGPT about your platform (in a few days)
   - Check Google Search Console
   - Monitor analytics

---

## 📞 Support

**Issues Found?**
- Document in QA_DEPLOYMENT_CHECKLIST.md
- Include error messages
- Note browser/device/OS
- Screenshot if helpful

**All Clear?**
- ✅ Sign off in checklist
- ✅ Deploy to production
- ✅ Monitor for 24 hours

---

**QA Contact:** Your Name  
**Deployment Target:** Replit Autoscale  
**Expected Uptime:** 99.9%  
**Support Hours:** 24/7 automated monitoring
