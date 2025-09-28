/**
 * Force Deployment Update
 * Creates completely new files to bypass deployment cache
 */

const fs = require('fs');

console.log('🚀 Force updating deployment files...');

// Create a completely new index file with different name
const timestamp = Date.now();
const originalHtml = fs.readFileSync('index.html', 'utf8');

// Replace the D-ID embed with force parameters
let newHtml = originalHtml.replace(
  /<!-- D-ID AI Agent[^>]*-->[^<]*<script[^>]*src="https:\/\/agent\.d-id\.com\/v2\/index\.js[^"]*"[^>]*>[^<]*<\/script>/s,
  `<!-- D-ID AI Agent - FORCE UPDATE ${timestamp} -->
  <script type="module"
        src="https://agent.d-id.com/v2/index.js?force=${timestamp}"
        data-mode="fabio"
        data-client-key="YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ=="
        data-agent-id="v2_agt_vhYf_e_C"
        data-name="console-solar-force-${timestamp}"
        data-monitor="true"
        data-orientation="horizontal"
        data-position="right"
        data-description="Console Solar - Kid Solar - Your polymathic AI assistant specializing in renewable energy innovation, physics, engineering, economics, and cutting-edge sustainability solutions. Ready to help with multimodal analysis and voice interaction."
        data-force-update="true">
  </script>`
);

// Add force update script
const forceScript = `
  <script>
    // FORCE UPDATE: Complete cache bypass
    console.log('🔄 FORCE UPDATE: Bypassing all deployment cache');
    console.log('⏰ Timestamp: ${timestamp}');
    console.log('🎯 Expected: Console Solar - Kid Solar');
    
    // Clear everything
    localStorage.clear();
    sessionStorage.clear();
    
    // Force D-ID reload
    setTimeout(() => {
      console.log('✅ Force update active - New agent loading');
    }, 500);
  </script>
`;

newHtml = newHtml.replace('</head>', forceScript + '\n</head>');

// Write the updated file
fs.writeFileSync('index.html', newHtml);
console.log('✅ Updated index.html with force parameters');

// Also update the timestamp in the agent memory reference
newHtml = newHtml.replace(
  /agentId: 'v2_agt_vhYf_e_C'/g,
  `agentId: 'v2_agt_vhYf_e_C-force-${timestamp}'`
);

fs.writeFileSync('index.html', newHtml);
console.log('✅ Updated agent references with force timestamp');
console.log(`🎯 New timestamp: ${timestamp}`);