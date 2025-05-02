/**
 * The Current-See Deployment Package Builder
 * 
 * This script prepares a deployment package with all necessary files
 * including our fixes for the TC-S Solar Reserve display issue.
 */

const fs = require('fs');
const path = require('path');

// Create deployment directory
const deploymentDir = './deployment-package';
const publicDir = path.join(deploymentDir, 'public');
const jsDir = path.join(publicDir, 'js');

console.log('Building deployment package...');

// Create directory structure if it doesn't exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

ensureDirectoryExists(deploymentDir);
ensureDirectoryExists(publicDir);
ensureDirectoryExists(jsDir);

// Copy main deployment script
try {
  fs.copyFileSync('./deploy-stable.js', path.join(deploymentDir, 'deploy-stable.js'));
  console.log('✓ Copied deploy-stable.js to deployment package');
} catch (error) {
  console.error(`Failed to copy deploy-stable.js: ${error.message}`);
}

// Copy fixed members log script
try {
  fs.copyFileSync('./public/js/fixed-members-log.js', path.join(jsDir, 'fixed-members-log.js'));
  console.log('✓ Copied fixed-members-log.js to deployment package');
} catch (error) {
  console.error(`Failed to copy fixed-members-log.js: ${error.message}`);
}

// Copy and update members-list.html to use the fixed script
try {
  let content = fs.readFileSync('./public/members-list.html', 'utf8');
  
  // Replace script src to use the fixed version
  content = content.replace(
    '<script src="/js/public-members-log.js"></script>',
    '<!-- Using fixed members log script to include TC-S Solar Reserve -->\n  <script src="/js/fixed-members-log.js"></script>'
  );
  
  fs.writeFileSync(path.join(publicDir, 'members-list.html'), content);
  console.log('✓ Copied and updated members-list.html to use fixed-members-log.js');
} catch (error) {
  console.error(`Failed to update members-list.html: ${error.message}`);
}

// Copy embedded members json file
try {
  fs.copyFileSync('./public/embedded-members.json', path.join(publicDir, 'embedded-members.json'));
  console.log('✓ Copied embedded-members.json to deployment package');
} catch (error) {
  console.error(`Failed to copy embedded-members.json: ${error.message}`);
}

// Copy test files
try {
  fs.copyFileSync('./public/final-members-test.html', path.join(publicDir, 'final-members-test.html'));
  console.log('✓ Copied final-members-test.html to deployment package');
} catch (error) {
  console.error(`Failed to copy final-members-test.html: ${error.message}`);
}

// Copy deployment checklist
try {
  fs.copyFileSync('./deployment-checklist.md', path.join(deploymentDir, 'CHECKLIST.md'));
  console.log('✓ Copied deployment checklist to deployment package');
} catch (error) {
  console.error(`Failed to copy deployment checklist: ${error.message}`);
}

console.log('\nDeployment package created successfully in ./deployment-package');
console.log('Ready for deployment to www.thecurrentsee.org');
console.log('\nDeployment steps:');
console.log('1. Upload the contents of ./deployment-package to your Replit project');
console.log('2. Run node deploy-stable.js on the server');
console.log('3. Verify all members including TC-S Solar Reserve are displayed correctly');