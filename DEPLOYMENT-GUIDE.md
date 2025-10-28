# Deployment Guide - www.thecurrentsee.org

## ✅ Pre-Deployment Checklist

Your application is ready for deployment with the following configuration:

- ✅ **Deployment Type:** Autoscale (configured in `.replit`)
- ✅ **Port Mapping:** 8080 → 80 (external)
- ✅ **Run Command:** `node main.js`
- ✅ **UIM Components:** All service discovery meta tags and headers configured
- ✅ **Satellite ID Anywhere:** Promotional section added to homepage
- ✅ **Database:** PostgreSQL configured
- ✅ **APIs:** Solar Standard, UIM Handshake, Satellite Lookup all ready

## 🚀 Step 1: Deploy to Replit

1. **Click the "Publish" button** at the top of your workspace
2. **Select "Autoscale Deployment"** (already configured)
3. **Review settings:**
   - Machine type: Choose based on expected traffic
   - Max machines: Set scaling limits
   - Min machines: Recommended at least 1 for always-on
4. **Click "Publish"** to launch

You'll receive a default URL like: `https://<your-app>.replit.app`

## 🌐 Step 2: Configure Custom Domain (www.thecurrentsee.org)

### A. In Replit Dashboard

1. Go to **Deployments** tab
2. Click on your active deployment
3. Navigate to **Settings** tab
4. Click **"Link a domain"** or **"Manually connect from another registrar"**
5. Enter your domain: `www.thecurrentsee.org`
6. Replit will generate DNS records:
   - **A Record** (points to Replit's IP)
   - **TXT Record** (for verification)

### B. In Your Domain Registrar (e.g., GoDaddy, Namecheap, Cloudflare)

Add these DNS records (values provided by Replit):

**For www.thecurrentsee.org:**
```
Type: A
Name: www
Value: [IP address from Replit]
TTL: Automatic or 3600
```

**For verification:**
```
Type: TXT
Name: _replit-challenge.www
Value: [verification token from Replit]
TTL: Automatic or 3600
```

**Optional - Apex domain (thecurrentsee.org):**
```
Type: A
Name: @
Value: [same IP address]
TTL: Automatic or 3600
```

### C. Wait for DNS Propagation

- **Typical time:** 5-30 minutes
- **Maximum:** Up to 48 hours
- **Check status:** Replit will show "Verified" when ready

### D. Important DNS Configuration Notes

⚠️ **Avoid these issues:**
- Don't create multiple A records for the same domain
- If using Cloudflare, **disable proxy** (orange cloud) for Replit domains
- Ensure no conflicting CNAME records exist

## 🧪 Step 3: Verify Deployment

Once deployed, test all endpoints:

```bash
# Set your domain
DOMAIN="https://www.thecurrentsee.org"

# 1. Homepage
curl -I ${DOMAIN}

# 2. UIM Discovery
curl -fsS ${DOMAIN}/.well-known/uim-handshake.json | jq .

# 3. Health Check
curl -fsS ${DOMAIN}/healthz | jq .

# 4. Readiness Check
curl -fsS ${DOMAIN}/readyz | jq .

# 5. Satellite Lookup (ISS)
curl -fsS "${DOMAIN}/api/lookup?norad=25544" | jq .

# 6. Status Page
curl ${DOMAIN}/status

# 7. Solar Dashboard
curl -I ${DOMAIN}/solar-dashboard.html

# 8. Verify UIM Headers
curl -I ${DOMAIN}/healthz | grep "X-Service-Version"
```

## 📊 Expected Results

All endpoints should return:
- ✅ HTTP 200 OK
- ✅ UIM headers (X-Request-ID, X-Service-Version, X-Build-SHA)
- ✅ Valid JSON for API endpoints
- ✅ HTML for web pages

## 🔒 SSL/TLS Certificate

- **Automatic:** Replit provides free SSL certificates for custom domains
- **Protocol:** HTTPS is automatically enabled
- **Renewal:** Certificates auto-renew

## 📈 Post-Deployment Monitoring

Monitor your deployment:

1. **Logs:** Available in Replit Deployments tab
2. **Metrics:** CPU, memory, request count
3. **Scaling:** Auto-scales based on traffic
4. **Health:** `/healthz` and `/readyz` endpoints

## 🔧 Environment Variables

Ensure these secrets are set in your deployment:

- ✅ `DATABASE_URL` - PostgreSQL connection
- ✅ `OPENAI_API_KEY` - For AI features
- ✅ `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage
- ✅ Other PG* variables (auto-configured)

## 🌐 UIM Service Discovery

After deployment, your service will be discoverable at:

- **Service Name:** satellite-id-anywhere
- **Version:** 1.0.0
- **Build SHA:** urn:sha256:79cb6cf146c700b654d8aa55f17071e6060e682189e51733c2d46134f04a8f74
- **Capabilities:** lookup.cospar, lookup.norad, normalize.record

## 📱 Final Checklist

Before going live:

- [ ] Deployment successful on Replit
- [ ] Custom domain configured and verified
- [ ] SSL certificate active (HTTPS working)
- [ ] All API endpoints responding
- [ ] UIM headers present
- [ ] Database connected
- [ ] Solar Dashboard accessible
- [ ] Satellite ID Anywhere section visible
- [ ] Foundation plate link working
- [ ] Mobile responsive design verified

## 🎉 Launch!

Once all checks pass, your TC-S Network Foundation platform will be live at:

**https://www.thecurrentsee.org**

---

## 📞 Troubleshooting

### Domain Not Verifying
- Check DNS records match Replit exactly
- Wait longer (up to 48 hours)
- Use `dig www.thecurrentsee.org` to verify DNS propagation

### SSL Certificate Issues
- Ensure domain is verified first
- SSL provisions after domain verification
- Contact Replit support if issues persist

### 500/502 Errors
- Check deployment logs
- Verify DATABASE_URL is set
- Ensure port 8080 is listening
- Check that `node main.js` starts successfully

### UIM Headers Missing
- Verify main.js has UIM middleware active
- Check response headers with `curl -I`
- Ensure deployment used latest code

---

**Ready to deploy?** Click the Publish button to begin! 🚀
