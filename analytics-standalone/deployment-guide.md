# Analytics Dashboard Deployment Guide

## Quick Deploy Options

### Option 1: Netlify (Recommended)
1. Go to [netlify.com](https://netlify.com)
2. Drag the `analytics-standalone` folder to Netlify
3. Get instant HTTPS URL: `https://[random-name].netlify.app`
4. Configure custom domain: `analytics.thecurrentsee.org`

### Option 2: Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the analytics-standalone folder
3. Follow prompts for domain setup

### Option 3: GitHub Pages
1. Create new GitHub repo: `current-see-analytics`
2. Upload files to repo
3. Enable GitHub Pages in repo settings
4. Configure custom domain in DNS

## DNS Configuration

For `analytics.thecurrentsee.org`:

```
Type: CNAME
Name: analytics
Value: [hosting-platform-url]
TTL: 3600
```

Example DNS records:
- **Netlify**: `analytics CNAME [app-name].netlify.app`
- **Vercel**: `analytics CNAME [app-name].vercel.app`  
- **GitHub**: `analytics CNAME [username].github.io`

## HTTPS Setup

All recommended platforms provide automatic HTTPS:
- ✅ Netlify: Automatic SSL with Let's Encrypt
- ✅ Vercel: Automatic SSL for all domains
- ✅ GitHub Pages: Built-in SSL support
- ✅ Cloudflare Pages: Edge SSL termination

## File Structure

```
analytics-standalone/
├── index.html          # Main dashboard
├── deploy.json         # Deployment configuration
├── README.md           # Documentation
└── deployment-guide.md # This guide
```

## Verification

After deployment, verify:
1. ✅ HTTPS working: `https://analytics.thecurrentsee.org`
2. ✅ Mobile responsive design
3. ✅ All metrics displaying correctly
4. ✅ Contact links functional

## Integration

This dashboard is completely independent from:
- Main website: `www.thecurrentsee.org`
- Admin systems
- Database connections

It displays static metrics that can be updated manually or via API integration if needed in the future.

## Maintenance

Update metrics by editing the values in `index.html`:
- Member counts
- SOLAR distribution numbers
- Engagement statistics
- Platform features

The dashboard auto-calculates days operational from the April 7, 2025 inception date.