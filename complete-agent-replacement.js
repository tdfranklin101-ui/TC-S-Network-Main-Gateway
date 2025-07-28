/**
 * Complete Agent Replacement Script
 * Removes ALL old agent references and replaces with new Console Solar agent
 */

const fs = require('fs');

console.log('🔄 Complete Agent Replacement: Removing all old agent references...');

// Files to update
const filesToUpdate = [
  'index.html',
  'public/index.html',
  'public/wallet.html',
  'stable-server.js',
  'memory-storage-enhanced.html'
];

// Old agent credentials to replace
const oldCredentials = {
  agentId: 'v2_agt_lmJp1s6K',
  clientKey: 'Z29vZ2xlLW9hdXRoMnwxMDcyNjAyNzY5Mjc4NTMyMjY1MjM6NEt2UC1nU1hRZmFDUTJvcUZKdzY2',
  name: 'did-agent'
};

// New Console Solar agent credentials
const newCredentials = {
  agentId: 'v2_agt_vhYf_e_C',
  clientKey: 'YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ==',
  name: 'console-solar-agent',
  description: 'Console Solar - Kid Solar - Your polymathic AI assistant specializing in renewable energy innovation, physics, engineering, economics, and cutting-edge sustainability solutions.'
};

// Update each file
filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace all old agent ID references
    content = content.replace(/v2_agt_lmJp1s6K/g, newCredentials.agentId);
    
    // Replace all old client key references
    content = content.replace(/Z29vZ2xlLW9hdXRoMnwxMDcyNjAyNzY5Njc4NTMyMjY1MjM6NEt2UC1nU1hRZmFDUTJvcUZKdzY2/g, newCredentials.clientKey);
    
    // Replace agent names
    content = content.replace(/data-name="did-agent"/g, `data-name="${newCredentials.name}"`);
    
    // Add description if missing
    if (content.includes('data-agent-id="v2_agt_vhYf_e_C"') && !content.includes('data-description=')) {
      content = content.replace(
        /data-position="right"/g,
        `data-position="right"\n        data-description="${newCredentials.description}"`
      );
    }
    
    // Update console log references
    content = content.replace(/TC-S Agent S0001/g, 'Console Solar - Kid Solar');
    content = content.replace(/TCS/g, 'Console Solar');
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  } else {
    console.log(`⚠️ File not found: ${filePath}`);
  }
});

console.log('\n🎯 Agent Replacement Complete');
console.log(`New Agent ID: ${newCredentials.agentId}`);
console.log(`New Description: Console Solar - Kid Solar`);
console.log('All old agent references have been replaced');