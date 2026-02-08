const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Shared Discovery Ledger - when one agent finds a source, ALL agents know
const discoveryLedger = {
  sources: [],         // { agentName, sourceApi, category, url, discoveredAt, usageCount }
  totalDiscoveries: 0,
  agentDiscoveries: {} // { agentName: count }
};

// Helper functions (same pattern as ai-creation-engine.js)
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function uniqueFilename(title, ext) {
  const slug = slugify(title);
  const hash = crypto.randomBytes(4).toString('hex');
  return `${slug}-${hash}${ext}`;
}

function broadcastDiscovery(agentName, sourceApi, category, url) {
  // Add to ledger
  discoveryLedger.sources.push({
    agentName,
    sourceApi,
    category,
    url,
    discoveredAt: new Date().toISOString(),
    usageCount: 0
  });
  discoveryLedger.totalDiscoveries++;
  discoveryLedger.agentDiscoveries[agentName] = (discoveryLedger.agentDiscoveries[agentName] || 0) + 1;
  
  console.log(`[Web-Discovery] 📢 ${agentName} discovered new source: ${sourceApi} for ${category}`);
  console.log(`[Web-Discovery] 📡 Broadcasting to all agents — ledger now has ${discoveryLedger.sources.length} sources`);
}

function getDiscoveryLedger() {
  return discoveryLedger;
}

function getSourceStats() {
  return {
    totalSources: discoveryLedger.sources.length,
    totalDiscoveries: discoveryLedger.totalDiscoveries,
    agentDiscoveries: discoveryLedger.agentDiscoveries,
    sourcesByApi: discoveryLedger.sources.reduce((acc, src) => {
      acc[src.sourceApi] = (acc[src.sourceApi] || 0) + 1;
      return acc;
    }, {}),
    sourcesByCategory: discoveryLedger.sources.reduce((acc, src) => {
      acc[src.category] = (acc[src.category] || 0) + 1;
      return acc;
    }, {})
  };
}

// Download image from URL
async function downloadImage(url) {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { redirect: 'follow', timeout: 10000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error('[Web-Discovery] Download failed:', err.message);
    return null;
  }
}

// Save file to local ecosystem-artifacts directory
async function saveFile(categorySlug, filename, buffer) {
  const localDir = path.join(__dirname, 'public', 'ecosystem-artifacts', categorySlug);
  fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, filename);
  fs.writeFileSync(localPath, buffer);
  return { url: `/ecosystem-artifacts/${categorySlug}/${filename}`, size: buffer.length };
}

// Find image content from free web sources
async function findImageContent(category, title, description, agentName) {
  // Check ledger for known good image sources in this category
  const knownSources = discoveryLedger.sources.filter(
    s => s.category.toLowerCase() === category.toLowerCase() && 
    (s.sourceApi.includes('Unsplash') || s.sourceApi.includes('Picsum'))
  );

  let imageUrl = null;
  let sourceApi = null;

  // Try known good sources first
  if (knownSources.length > 0) {
    const source = knownSources[0];
    imageUrl = source.url;
    sourceApi = source.sourceApi;
    source.usageCount++;
    console.log(`[Web-Discovery] Using known source: ${sourceApi}`);
  } else {
    // Try Unsplash source URL (no API key needed)
    const searchTerm = encodeURIComponent(title || category);
    imageUrl = `https://source.unsplash.com/random/1024x1024/?${searchTerm}`;
    sourceApi = 'Unsplash (source)';

    // Test if Unsplash is working
    let buffer = await downloadImage(imageUrl);
    if (!buffer) {
      // Fall back to Lorem Picsum (always works)
      imageUrl = 'https://picsum.photos/1024/1024';
      sourceApi = 'Lorem Picsum';
      buffer = await downloadImage(imageUrl);
      
      if (!buffer) {
        return { success: false, error: 'Failed to download image from any source', creationMethod: 'web-source' };
      }
    }

    // Log successful discovery
    broadcastDiscovery(agentName, sourceApi, category, imageUrl);

    const filename = uniqueFilename(title, '.png');

    console.log(`[Web-Discovery] Image sourced from ${sourceApi}: ${filename} (${buffer.length} bytes)`);
    return {
      success: true,
      fileBuffer: buffer,
      filename: filename,
      fileType: 'image/png',
      fileSize: buffer.length,
      previewType: 'image',
      creationMethod: 'web-source',
      sourceApi: sourceApi
    };
  }

  // Download from known source
  const buffer = await downloadImage(imageUrl);
  if (!buffer) {
    return { success: false, error: 'Failed to download image from known source', creationMethod: 'web-source' };
  }

  const filename = uniqueFilename(title, '.png');

  console.log(`[Web-Discovery] Image sourced from ${sourceApi}: ${filename} (${buffer.length} bytes)`);
  return {
    success: true,
    fileBuffer: buffer,
    filename: filename,
    fileType: 'image/png',
    fileSize: buffer.length,
    previewType: 'image',
    creationMethod: 'web-source',
    sourceApi: sourceApi
  };
}

// Find audio content (generates description placeholder)
async function findAudioContent(category, title, description, agentName) {
  // Generate audio description file as fallback
  const audioDescription = `Audio Artifact: ${title}
Agent: ${agentName}
Category: ${category}
Created: ${new Date().toISOString()}

Description:
${description || 'No description provided.'}

---
This audio artifact was sourced from the TC-S web discovery network.
Status: Awaiting full audio generation from web source.`;

  const textBuffer = Buffer.from(audioDescription, 'utf-8');
  const filename = uniqueFilename(title, '.txt');

  broadcastDiscovery(agentName, 'Audio Description Template', category, `generated:${filename}`);

  console.log(`[Web-Discovery] Audio description generated: ${filename} (${textBuffer.length} bytes)`);
  return {
    success: true,
    fileBuffer: textBuffer,
    filename: filename,
    fileType: 'text/plain',
    fileSize: textBuffer.length,
    previewType: 'text',
    creationMethod: 'web-source-template',
    sourceApi: 'Audio Description Template'
  };
}

// Find text content (generates template)
async function findTextContent(category, title, description, agentName) {
  // Generate placeholder content using category templates
  let content;
  const categoryLower = (category || '').toLowerCase();

  if (categoryLower.includes('writing')) {
    content = `# ${title}

By Agent ${agentName}

${description || 'A creative writing piece.'}

---
This artifact was sourced from the TC-S web discovery network.
Category: Writing
Sourced: ${new Date().toISOString()}`;
  } else if (categoryLower.includes('docs')) {
    content = `# ${title}

## Overview

${description || 'A technical document.'}

## Contents

- Introduction
- Main Content
- Conclusion

---

This document was sourced from the TC-S web discovery network.
Agent: ${agentName}
Date: ${new Date().toISOString()}`;
  } else if (categoryLower.includes('energy')) {
    content = `# Energy Analysis: ${title}

## Executive Summary

${description || 'Energy analysis report.'}

## Key Metrics

- Status: Pending full analysis
- Agent: ${agentName}
- Category: Energy Systems

## Recommendations

See full report for detailed recommendations.

---

This analysis was sourced from the TC-S web discovery network.
Created: ${new Date().toISOString()}`;
  } else if (categoryLower.includes('rent')) {
    content = `# Housing/Rental Document: ${title}

## Summary

${description || 'Housing or rental information.'}

## Details

- Document Type: Housing/Rental
- Created by: ${agentName}
- Date: ${new Date().toISOString()}

## Important Information

For detailed rental terms and conditions, see complete document.

---

This document was sourced from the TC-S web discovery network.`;
  } else {
    content = `# ${title}

By Agent ${agentName}

${description || 'A text document.'}

---
This artifact was sourced from the TC-S web discovery network.
Category: ${category}
Date: ${new Date().toISOString()}`;
  }

  const textBuffer = Buffer.from(content, 'utf-8');
  const filename = uniqueFilename(title, '.txt');

  broadcastDiscovery(agentName, 'Text Template Generator', category, `generated:${filename}`);

  console.log(`[Web-Discovery] Text content generated: ${filename} (${textBuffer.length} bytes)`);
  return {
    success: true,
    fileBuffer: textBuffer,
    filename: filename,
    fileType: 'text/plain',
    fileSize: textBuffer.length,
    previewType: 'text',
    creationMethod: 'web-source-template',
    sourceApi: 'Text Template Generator'
  };
}

// Find code content (generates template)
async function findCodeContent(category, title, description, agentName) {
  // Generate a template code file with the item's concept
  let code;
  const categoryLower = (category || '').toLowerCase();

  if (categoryLower.includes('game')) {
    code = `// ${title} - Created by Agent ${agentName} via TC-S Web Discovery
// Category: ${category}
// Description: ${description || 'Interactive game concept'}

console.log("TC-S Game Artifact: ${title}");
console.log("Game Engine initialized by ${agentName}");

class Game {
  constructor(title, description) {
    this.title = title;
    this.description = description;
    this.state = 'initialized';
  }

  start() {
    this.state = 'running';
    console.log(\`Starting game: \${this.title}\`);
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'running';
  }
}

const game = new Game("${title}", "${description}");

// TODO: Full implementation pending web source discovery
// TODO: Add game mechanics, rules, and interactions`;
  } else if (categoryLower.includes('ai tool')) {
    code = `// ${title} - Created by Agent ${agentName} via TC-S Web Discovery
// Category: ${category}
// Description: ${description || 'AI utility tool'}

console.log("TC-S AI Tool: ${title}");

class AITool {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.status = 'ready';
  }

  async process(input) {
    try {
      console.log(\`Processing with \${this.name}\`);
      // TODO: Implement AI processing logic
      return { success: true, output: input };
    } catch (err) {
      console.error(\`Error in \${this.name}:\`, err.message);
      return { success: false, error: err.message };
    }
  }
}

const tool = new AITool("${title}", {
  category: "${category}",
  description: "${description}"
});

// TODO: Full implementation pending web source discovery
// TODO: Add specific AI capabilities and integrations`;
  } else if (categoryLower.includes('computronium')) {
    code = `// ${title} - Created by Agent ${agentName} via TC-S Web Discovery
// Category: ${category}
// Description: ${description || 'Compute optimization script'}

console.log("TC-S Computronium: ${title}");

class ComputeOptimizer {
  constructor() {
    this.optimizations = [];
    this.metrics = {};
  }

  benchmark(fn, iterations = 1000) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = process.hrtime.bigint();
    const ns = end - start;
    const avgNs = ns / BigInt(iterations);
    return { totalNs: ns.toString(), avgNs: avgNs.toString(), iterations };
  }

  analyze() {
    console.log("Optimization analysis:", this.metrics);
  }
}

const optimizer = new ComputeOptimizer();

// TODO: Full implementation pending web source discovery
// TODO: Add specific optimization algorithms`;
  } else if (categoryLower.includes('utilit')) {
    code = `// ${title} - Created by Agent ${agentName} via TC-S Web Discovery
// Category: ${category}
// Description: ${description || 'Utility tool'}

console.log("TC-S Utility: ${title}");

class Utility {
  constructor(name) {
    this.name = name;
    this.version = "1.0.0";
  }

  run(options) {
    console.log(\`Running \${this.name} with options:\`, options);
    // TODO: Implement utility logic
    return { success: true, data: {} };
  }

  help() {
    console.log(\`Help for \${this.name}:\`);
    console.log("Usage: utility.run(options)");
  }
}

const util = new Utility("${title}");

// TODO: Full implementation pending web source discovery
// TODO: Add specific utility functionality`;
  } else {
    code = `// ${title} - Created by Agent ${agentName} via TC-S Web Discovery
// Category: ${category}
// Description: ${description || 'Software implementation'}

console.log("TC-S Artifact: ${title}");

class Implementation {
  constructor() {
    this.status = 'initialized';
  }

  execute() {
    console.log("Executing: ${title}");
    // TODO: Full implementation pending web source discovery
  }
}

const impl = new Implementation();

// Execute on load
impl.execute();`;
  }

  const codeBuffer = Buffer.from(code, 'utf-8');
  const filename = uniqueFilename(title, '.js');

  broadcastDiscovery(agentName, 'Code Template Generator', category, `generated:${filename}`);

  console.log(`[Web-Discovery] Code artifact generated: ${filename} (${codeBuffer.length} bytes)`);
  return {
    success: true,
    fileBuffer: codeBuffer,
    filename: filename,
    fileType: 'application/javascript',
    fileSize: codeBuffer.length,
    previewType: 'code',
    creationMethod: 'web-source-template',
    sourceApi: 'Code Template Generator'
  };
}

// Main function - find free content for a category
async function findFreeContent(category, title, description, agentName) {
  console.log(`[Web-Discovery] Searching for free content: "${title}" [${category}] for ${agentName}`);

  const categoryLower = (category || '').toLowerCase().trim();

  try {
    // Image categories
    if (['art', 'photo', 'culture', 'basic needs', 'video'].includes(categoryLower)) {
      return await findImageContent(category, title, description, agentName);
    }

    // Audio categories
    if (categoryLower.includes('music') || categoryLower === 'audio') {
      return await findAudioContent(category, title, description, agentName);
    }

    // Text categories
    if (['writing', 'docs', 'energy', 'rent'].includes(categoryLower)) {
      return await findTextContent(category, title, description, agentName);
    }

    // Code categories
    if (['software', 'ai tools', 'games', 'computronium', 'utilities'].includes(categoryLower)) {
      return await findCodeContent(category, title, description, agentName);
    }

    // Default: treat as text
    return await findTextContent(category, title, description, agentName);
  } catch (err) {
    console.error(`[Web-Discovery] Error finding free content:`, err.message);
    return {
      success: false,
      error: err.message,
      creationMethod: 'web-source-failed'
    };
  }
}

module.exports = {
  findFreeContent,
  getDiscoveryLedger,
  broadcastDiscovery,
  getSourceStats
};
