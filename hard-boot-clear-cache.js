/**
 * Hard Boot Cache Clearing System
 * Forces complete server restart and cache elimination
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 HARD BOOT: Implementing complete cache clearing...');

// 1. Clear all possible cache directories
const cacheDirs = [
  'node_modules/.cache',
  '.next',
  'dist',
  '.cache',
  '.vite',
  'build'
];

cacheDirs.forEach(dir => {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Cleared cache directory: ${dir}`);
    }
  } catch (error) {
    console.log(`⚠️ Could not clear ${dir}:`, error.message);
  }
});

// 2. Force timestamp update on main files
const mainFiles = [
  'index.html',
  'stable-server.js',
  'main.js'
];

mainFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const now = new Date();
    fs.utimesSync(file, now, now);
    console.log(`⏰ Updated timestamp: ${file}`);
  }
});

// 3. Create cache-busting marker
const cacheBustMarker = {
  timestamp: Date.now(),
  version: 'hard-boot-20250728',
  didAgent: 'v2_agt_vhYf_e_C',
  description: 'Console Solar - Kid Solar',
  action: 'COMPLETE_CACHE_CLEAR'
};

fs.writeFileSync('.cache-bust-marker.json', JSON.stringify(cacheBustMarker, null, 2));
console.log('🎯 Created cache-busting marker');

// 4. Force D-ID script reload with new parameters
console.log('📝 Updating D-ID script with hard cache-busting...');

const indexPath = 'index.html';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Replace D-ID script with hard cache-busting
  const newTimestamp = Date.now();
  content = content.replace(
    /src="https:\/\/agent\.d-id\.com\/v2\/index\.js\?[^"]*"/,
    `src="https://agent.d-id.com/v2/index.js?hardboot=${newTimestamp}"`
  );
  
  // Update agent name with hard boot marker
  content = content.replace(
    /data-name="[^"]*"/,
    `data-name="kid-solar-hardboot-${newTimestamp}"`
  );
  
  fs.writeFileSync(indexPath, content);
  console.log('✅ D-ID script updated with hard cache-busting');
}

console.log('\n🚀 HARD BOOT COMPLETE - Cache completely cleared');
console.log('💡 Server restart required for changes to take effect');
console.log('🎯 New D-ID agent should load without any cached interference\n');