const fs = require("fs");
const crypto = require("crypto");

const standardPath = "public/SolarStandard.json";
const feedPath     = "public/SolarFeed.xml";
const verifyPath   = "public/solar-verification.json";
const logPath      = "public/solar-audit.log";

function sha256File(path) {
  const buf = fs.readFileSync(path);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function writeLog(line) {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
}

try {
  const standardHash = sha256File(standardPath);
  const feedHash     = sha256File(feedPath);

  let current = {};
  if (fs.existsSync(verifyPath)) {
    current = JSON.parse(fs.readFileSync(verifyPath, "utf8"));
  }

  const newIdentifier = `urn:sha256:${standardHash}`;
  if (current.identifier !== newIdentifier) {
    const json = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "name": "Solar Standard Verification",
      "identifier": newIdentifier,
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
      "dateIssued": new Date().toISOString().slice(0,10),
      "isBasedOn": "https://www.thecurrentsee.org/SolarStandard.html",
      "encodingFormat": "application/json"
    };
    fs.writeFileSync(verifyPath, JSON.stringify(json, null, 2));
    writeLog(`hash updated — ${standardHash}`);
  } else {
    writeLog(`verified — ${standardHash}`);
  }

  writeLog(`feed integrity — ${feedHash}`);
  console.log("✅ Foundation audit complete.");
} catch (err) {
  console.error("❌ Foundation audit error:", err);
  writeLog(`error — ${err.message}`);
}
