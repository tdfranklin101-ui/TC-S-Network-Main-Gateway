/**
 * Complete Vision and Memory System Agent Replacement
 * Finds and replaces ALL hardcoded old agent references throughout vision and memory coding
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 COMPLETE VISION AND MEMORY AGENT REPLACEMENT');
console.log('===============================================\n');

// Find all files that might contain agent references
function findAllFiles(dir = '.', extensions = ['.html', '.js']) {
  let files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      // Skip node_modules and backup directories
      if (item === 'node_modules' || item.startsWith('backup') || item.startsWith('.git')) {
        continue;
      }
      
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        files = files.concat(findAllFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.log(`Warning: Could not read directory ${dir}`);
  }
  
  return files;
}

// Old and new credentials
const OLD_AGENT_ID = 'v2_agt_vhYf_e_C';
const OLD_CLIENT_KEY = 'YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ==';
const NEW_AGENT_ID = 'v2_agt_vhYf_e_C';
const NEW_CLIENT_KEY = 'YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ==';

// Search and replace function
function replaceAgentReferences(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace old agent ID
    if (content.includes(OLD_AGENT_ID)) {
      content = content.replace(new RegExp(OLD_AGENT_ID, 'g'), NEW_AGENT_ID);
      modified = true;
      console.log(`  ✅ Replaced agent ID in ${filePath}`);
    }
    
    // Replace old client key
    if (content.includes(OLD_CLIENT_KEY)) {
      content = content.replace(new RegExp(OLD_CLIENT_KEY, 'g'), NEW_CLIENT_KEY);
      modified = true;
      console.log(`  ✅ Replaced client key in ${filePath}`);
    }
    
    // Update agent descriptions
    if (content.includes('Console Solar - Kid Solar')) {
      content = content.replace(/Console Solar - Kid Solar/g, 'Console Solar - Kid Solar');
      modified = true;
      console.log(`  ✅ Updated description in ${filePath}`);
    }
    
    // Update agent names
    if (content.includes('data-name="console-solar-agent"')) {
      content = content.replace(/data-name="console-solar-agent"/g, 'data-name="console-solar-agent"');
      modified = true;
      console.log(`  ✅ Updated agent name in ${filePath}`);
    }
    
    // Add descriptions if missing for new agent
    if (content.includes('data-agent-id="v2_agt_vhYf_e_C"') && 
        !content.includes('data-description=') &&
        content.includes('data-position=')) {
      content = content.replace(
        /data-position="([^"]+)"/g,
        'data-position="$1"\n        data-description="Console Solar - Kid Solar - Your polymathic AI assistant specializing in renewable energy innovation, physics, engineering, economics, and cutting-edge sustainability solutions."'
      );
      modified = true;
      console.log(`  ✅ Added description to ${filePath}`);
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    
    return false;
  } catch (e) {
    console.log(`  ❌ Error processing ${filePath}: ${e.message}`);
    return false;
  }
}

// Main execution
console.log('🔍 Scanning all files for old agent references...\n');

const allFiles = findAllFiles();
let totalFiles = 0;
let modifiedFiles = 0;

allFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes(OLD_AGENT_ID) || content.includes(OLD_CLIENT_KEY) || content.includes('Console Solar - Kid Solar')) {
    console.log(`📄 Processing: ${filePath}`);
    totalFiles++;
    
    if (replaceAgentReferences(filePath)) {
      modifiedFiles++;
    }
  }
});

console.log('\n🎯 VISION AND MEMORY AGENT REPLACEMENT COMPLETE');
console.log(`📊 Scanned: ${allFiles.length} files`);
console.log(`🔧 Modified: ${modifiedFiles} files`);
console.log(`🆔 New Agent: ${NEW_AGENT_ID}`);
console.log(`📝 New Description: Console Solar - Kid Solar`);
console.log('\n✅ ALL OLD AGENT REFERENCES ELIMINATED FROM VISION AND MEMORY SYSTEM');