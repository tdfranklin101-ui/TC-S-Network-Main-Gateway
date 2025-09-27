# TC‑S Generator Protocol — Beta Prototype (NOT LIVE)

This bundle contains a **prototype web page** and **stub backend** to demo the Generator Protocol.  
All text and logic are **mock/demo only** — no real trades or money.

## Contents
- `home.html` — simple homepage with link to the beta page
- `index.html` — the Beta page (forms, sliders, mock calculations)
- `styles.css` — dark UI
- `app.js` — front‑end logic (localStorage + mock preview)
- `server.js` — Node/Express stub with JSON file persistence
- `schema.md` — data model suggestions (DynamoDB + optional SQL)
- `api.examples.http` — sample HTTP requests

## Run (front‑end only)
Open `home.html` or `index.html` in your browser.

## Run stub API (Node 18+)
```bash
npm init -y
npm i express body-parser cors nanoid
node server.js
# Open http://localhost:8080/api/debug/db
```
> ⚠️ Stub only; not secure; not production; no payments.

## Deploying as a "Beta" page
- Upload `home.html`, `index.html`, `styles.css`, `app.js` to your static host (e.g., S3/CloudFront).
- Ensure the **prototype banner** remains visible.
- Link to `index.html` from your real homepage nav: “Generator Protocol (Beta)”.

## Notes
- TC‑S acts purely as software infrastructure; **no funding**.
- Per‑kWh mutual exclusivity for REC vs CC; supports split (e.g., 55%/45%).
- In **No‑Commissioner** mode, generator may **KEEP** or **DONATE_GBI** the commissioner portion.

