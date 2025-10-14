#!/bin/bash
# ==========================================================
# TC-S Network | Solar Standard Protocol Quick Setup
# ==========================================================
# Creates folder structure, pulls SolarStandard files,
# computes SHA-256 hash, and prepares verification JSON template
# ----------------------------------------------------------

echo "☀️  Initializing Solar Standard directory structure..."

mkdir -p public/assets public/solar-index api/solar api/ledger/rec generators

# ----------------------------------------------------------
# 1. Download Solar Standard & Feed for local reference
# ----------------------------------------------------------
curl -sS https://www.thecurrentsee.org/SolarStandard.json -o public/SolarStandard.json
curl -sS https://www.thecurrentsee.org/SolarFeed.xml -o public/SolarFeed.xml

# ----------------------------------------------------------
# 2. Compute SHA-256 hash for verification JSON
# ----------------------------------------------------------
HASH=$(sha256sum public/SolarStandard.json | cut -d " " -f1)
echo "✅ SolarStandard.json hash computed:"
echo "$HASH"
echo
echo "📋 Copy this hash when you edit /public/solar-verification.json"
echo

# ----------------------------------------------------------
# 3. Create verification JSON template (user must edit hash)
# ----------------------------------------------------------
cat > public/solar-verification.json <<EOF
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "Solar Standard Verification",
  "identifier": "urn:sha256:REPLACE_WITH_HASH",
  "about": {
    "@type": "DefinedTerm",
    "name": "Solar Standard Protocol v1.0",
    "termCode": "SP-1.0",
    "url": "https://www.thecurrentsee.org/SolarStandard.json"
  },
  "publisher": {
    "@type": "Organization",
    "name": "TC-S Network Foundation, Inc.",
    "url": "https://www.thecurrentsee.org"
  },
  "dateIssued": "2025-10-14",
  "isBasedOn": "https://www.thecurrentsee.org/SolarStandard.html",
  "encodingFormat": "application/json"
}
EOF

# ----------------------------------------------------------
# 4. Add the verified badge SVG
# ----------------------------------------------------------
cat > public/assets/solar-verified.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="168" height="36" viewBox="0 0 168 36" role="img" aria-label="Verified by the Solar Standard Protocol">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00E6A5"/>
      <stop offset="1" stop-color="#00B38A"/>
    </linearGradient>
  </defs>
  <rect rx="9" ry="9" width="168" height="36" fill="#0b0b0b" stroke="url(#g)"/>
  <circle cx="18" cy="18" r="8" fill="none" stroke="url(#g)" stroke-width="2.5"/>
  <path d="M14.2 18.3l2.5 2.6 5.3-5.8" fill="none" stroke="#00E6A5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="36" y="23" font-family="Inter, ui-sans-serif, system-ui" font-size="13" fill="#dfffe9" letter-spacing=".2px">
    Verified by Solar Standard
  </text>
</svg>
SVG

# ----------------------------------------------------------
# 5. Reminder for manual tasks
# ----------------------------------------------------------
echo
echo "------------------------------------------------------------"
echo "🌞  NEXT STEPS"
echo "------------------------------------------------------------"
echo "1. Open public/solar-verification.json"
echo "2. Replace the text REPLACE_WITH_HASH with this value:"
echo
echo "   $HASH"
echo
echo "3. Save the file."
echo "4. Add this to your HTML (footer or header):"
echo
echo '   <a href="/SolarStandard.html" rel="standard noopener">'
echo '     <img src="/assets/solar-verified.svg" alt="Verified by Solar Standard Protocol" height="36">'
echo '   </a>'
echo '   <script type="application/ld+json" src="/solar-verification.json"></script>'
echo
echo "Then you can move on to Steps 2–4 (GitHub mirror, ledger APIs, outreach)."
echo "------------------------------------------------------------"
