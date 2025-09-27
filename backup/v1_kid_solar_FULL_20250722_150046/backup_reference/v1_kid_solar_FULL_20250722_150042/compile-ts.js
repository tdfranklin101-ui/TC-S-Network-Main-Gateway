/**
 * TypeScript to JavaScript Transpiler
 * 
 * This script will transpile TypeScript modules to JavaScript
 * so they can be used in CommonJS environment.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if TypeScript is installed
exec('npm list typescript -g', (error, stdout, stderr) => {
  if (stdout.includes('(empty)')) {
    console.log('Installing TypeScript...');
    exec('npm install -g typescript', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error installing TypeScript: ${error.message}`);
        return;
      }
      console.log('TypeScript installed successfully');
      transpileFiles();
    });
  } else {
    console.log('TypeScript is already installed');
    transpileFiles();
  }
});

function transpileFiles() {
  console.log('Transpiling TypeScript files...');
  
  const files = [
    { src: './shared/schema.ts', dest: './shared/schema.js' },
    { src: './server/db.ts', dest: './server/db.js' },
    { src: './server/storage.ts', dest: './server/storage.js' },
    { src: './server/migrate-members.ts', dest: './server/migrate-members.js' }
  ];
  
  // Create directories if they don't exist
  if (!fs.existsSync('./server')) {
    fs.mkdirSync('./server');
  }
  
  if (!fs.existsSync('./shared')) {
    fs.mkdirSync('./shared');
  }
  
  // Manually transpile TypeScript to JavaScript
  files.forEach(file => {
    if (fs.existsSync(file.src)) {
      const content = fs.readFileSync(file.src, 'utf8');
      
      // Simple conversion of TypeScript to JavaScript
      let jsContent = content
        // Remove type annotations
        .replace(/:\s*[A-Za-z<>\[\]|{},\s]+(?=(=|,|\)))/g, '')
        // Remove interface declarations
        .replace(/interface\s+[A-Za-z]+\s*\{[\s\S]*?\}/g, '')
        // Remove type declarations
        .replace(/type\s+[A-Za-z]+\s*=[\s\S]*?;/g, '')
        // Convert imports to CommonJS require
        .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, 'const {$1} = require("$2")')
        .replace(/import\s+\*\s+as\s+([A-Za-z]+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")')
        // Convert exports
        .replace(/export\s+const/g, 'const')
        .replace(/export\s+function/g, 'function')
        .replace(/export\s+class/g, 'class')
        .replace(/export\s+\{([^}]+)\}/g, 'module.exports = {$1}')
        // Fix relative imports
        .replace(/require\(['"]\.\.\/([^'"]+)['"]\)/g, 'require("../$1")')
        // Remove type imports and exports
        .replace(/import\s+type[^;]+;/g, '')
        .replace(/export\s+type[^;]+;/g, '');
      
      // Add module.exports for specific cases
      if (file.src.includes('schema.ts')) {
        jsContent += `
module.exports = {
  members,
  distributionLogs,
  backupLogs,
  insertMemberSchema,
  insertDistributionLogSchema,
  insertBackupLogSchema
};
`;
      } else if (file.src.includes('db.ts')) {
        jsContent += `
module.exports = {
  pool,
  db,
  testConnection,
  getDatabaseInfo
};
`;
      } else if (file.src.includes('storage.ts')) {
        jsContent += `
module.exports = {
  storage
};
`;
      } else if (file.src.includes('migrate-members.ts')) {
        jsContent += `
module.exports = {
  migrateMembers
};
`;
      }
      
      // Write the transpiled file
      fs.writeFileSync(file.dest, jsContent);
      console.log(`Transpiled ${file.src} to ${file.dest}`);
    } else {
      console.error(`Source file ${file.src} does not exist`);
    }
  });
  
  console.log('TypeScript transpilation completed');
}