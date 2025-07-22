const fs = require('fs');
const path = require('path');

// Test all links from the homepage
const linksToTest = [
  // Internal pages
  { name: 'Q&A Meaning Purpose', url: '/qa-meaning-purpose', file: 'qa-meaning-purpose.html' },
  { name: 'Wallet', url: '/wallet.html', file: 'wallet.html' },
  { name: 'Declaration', url: '/declaration.html', file: 'declaration.html' },
  { name: 'Founder Note', url: '/founder_note.html', file: 'founder_note.html' },
  { name: 'Whitepapers', url: '/whitepapers.html', file: 'whitepapers.html' },
  { name: 'Business Plan', url: '/business_plan.html', file: 'business_plan.html' },
  { name: 'Private Network', url: '/private-network', file: 'private-network.html' },
  
  // External links
  { name: 'TC-S Wallet App', url: 'https://cross-platform-mobile-tdfranklin101.replit.app/welcome-orientation.html', external: true },
  { name: 'Solar Standard Book', url: 'https://books2read.com/u/4jx87l', external: true },
  { name: 'Podcast Discussion', url: 'https://youtu.be/FUXafe7HuTg?si=N3hLi6sYOaHQGCDI', external: true },
  { name: 'AI Energy Expert', url: 'https://energy-estimator-tdfranklin101.replit.app/', external: true },
  { name: 'Identify Anything AI', url: 'https://tc-identity-sync-tdfranklin101.replit.app/', external: true },
  { name: 'TC-SVR Game', url: 'https://pika.art/video/4be0181a-b6f5-4418-a1c6-18a18bcf7987', external: true }
];

console.log('📋 Testing all homepage links...\n');

// Test internal files
console.log('🔍 Internal Files Check:');
linksToTest.forEach(link => {
  if (!link.external) {
    const filePath = path.join(__dirname, 'public', link.file);
    const exists = fs.existsSync(filePath);
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${link.name}: ${link.file} ${exists ? 'EXISTS' : 'MISSING'}`);
  }
});

console.log('\n🌐 External Links:');
linksToTest.forEach(link => {
  if (link.external) {
    console.log(`🔗 ${link.name}: ${link.url}`);
  }
});

console.log('\n🎯 Summary:');
const internalLinks = linksToTest.filter(l => !l.external);
const missingFiles = internalLinks.filter(l => !fs.existsSync(path.join(__dirname, 'public', l.file)));

if (missingFiles.length === 0) {
  console.log('✅ All internal files are present');
} else {
  console.log(`❌ ${missingFiles.length} files missing:`);
  missingFiles.forEach(link => {
    console.log(`   - ${link.file}`);
  });
}