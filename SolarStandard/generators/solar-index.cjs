// CommonJS version for Node.js compatibility
// Usage: node SolarStandard/generators/solar-index.cjs --id=<id> --type=<type> --kwh=123 --name="Artifact Name" --verification=REC --source=SOLAR --geo=US-CA

const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=")];
  })
);

function required(name) {
  if (!args[name]) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return args[name];
}

const id = required("id");                // unique ID (uuid/slug/hash)
const type = required("type");            // DIGITAL_ARTIFACT | AI_MODEL | DATA_CENTER | TOKEN
const kWh = parseFloat(required("kwh"));
const name = required("name");
const verification = args.verification || "SELF_REPORTED";
const source = args.source || "UNKNOWN";  // SOLAR|WIND|HYDRO|MIXED|UNKNOWN
const geo = args.geo || "UNKNOWN";
const now = new Date().toISOString();

const solarEquivalent = +(kWh / 4913).toFixed(6);

const jsonld = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": name,
  "identifier": id,
  "category": type,
  "isAccessoryOrSparePartFor": "Solar Standard v1.0",
  "additionalProperty": [
    {"@type":"PropertyValue","name":"energy_consumed_kWh","value":kWh},
    {"@type":"PropertyValue","name":"solar_equivalent","value":solarEquivalent},
    {"@type":"PropertyValue","name":"renewable_source","value":source},
    {"@type":"PropertyValue","name":"verification","value":verification},
    {"@type":"PropertyValue","name":"geo_origin","value":geo},
    {"@type":"PropertyValue","name":"timestamp","value":now}
  ],
  "url": `https://www.thecurrentsee.org/artifacts/${id}.html`,
  "brand": {"@type":"Organization","name":"TC-S Network Foundation, Inc."}
};

// 1) Write per-artifact JSON-LD for embedding or serving directly
const outDir = path.join(__dirname, "..", "..", "public", "solar-index");
fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, `${id}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(jsonld, null, 2));

// 2) Append/update SolarFeed.xml with a new entry and refresh top-level <updated>
const feedPath = path.join(__dirname, "..", "..", "public", "SolarFeed.xml");
const feedExists = fs.existsSync(feedPath);
let feed = feedExists ? fs.readFileSync(feedPath, "utf-8") : "";

const entry = `
  <entry>
    <id>urn:solar:${id}</id>
    <title>${escapeXml(name)}</title>
    <summary>${kWh} kWh ⇒ ${solarEquivalent} Solar (${verification}/${source})</summary>
    <link href="https://www.thecurrentsee.org/solar-index/${id}.json"/>
    <updated>${now}</updated>
  </entry>`.trim();

if (!feedExists) {
  feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Solar Protocol Feed</title>
  <link href="https://www.thecurrentsee.org/SolarFeed.xml" rel="self"/>
  <updated>${now}</updated>
  ${entry}
</feed>`;
} else {
  // Update the top-level <updated> timestamp and append entry
  feed = feed.replace(/<updated>[^<]*<\/updated>/, `<updated>${now}</updated>`);
  feed = feed.replace("</feed>", `  ${entry}\n</feed>`);
}

fs.writeFileSync(feedPath, feed);

console.log(`✅ Indexed ${id}. JSON-LD → /public/solar-index/${id}.json and feed updated.`);

function escapeXml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
