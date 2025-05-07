const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'public');
const files = [
  'includes/header.html',
  'includes/footer.html',
  'whitepapers.html',
  'white_paper_7.html',
  'index.html',
  'solar-generator.html'
];

console.log('Testing file existence and readability:');
files.forEach(file => {
  const filePath = path.join(baseDir, file);
  try {
    const stat = fs.statSync(filePath);
    console.log(`✓ ${file} exists and is ${stat.size} bytes`);
    
    // Check if header/footer includes are referenced
    if (file.endsWith('.html') && !file.includes('includes/')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const hasHeaderInclude = content.includes('includes/header.html') || 
                              content.includes('<!-- HEADER_INCLUDE -->');
      const hasFooterInclude = content.includes('includes/footer.html') || 
                              content.includes('<!-- FOOTER_INCLUDE -->');
      
      console.log(`  - Header include: ${hasHeaderInclude ? '✓' : '✗'}`);
      console.log(`  - Footer include: ${hasFooterInclude ? '✓' : '✗'}`);
    }
  } catch (err) {
    console.log(`✗ Error with ${file}: ${err.message}`);
  }
});
