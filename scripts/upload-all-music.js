const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');

async function uploadAllMusic() {
  const client = new Client();
  
  // Define all music directories
  const musicDirs = [
    { local: path.join(__dirname, '..', 'public', 'music', 'monazite'), remote: 'public/music/monazite' },
    { local: path.join(__dirname, '..', 'public', 'music'), remote: 'public/music', pattern: /\.mp3$/ },
    { local: path.join(__dirname, '..', 'public', 'media'), remote: 'public/media', pattern: /\.mp3$/ }
  ];
  
  let uploaded = 0;
  let failed = 0;
  
  for (const dir of musicDirs) {
    if (!fs.existsSync(dir.local)) {
      console.log(`⚠️ Directory not found: ${dir.local}`);
      continue;
    }
    
    const files = fs.readdirSync(dir.local).filter(f => {
      if (dir.pattern) return dir.pattern.test(f);
      return f.endsWith('.mp3');
    });
    
    for (const file of files) {
      // Skip subdirectories for non-monazite dirs
      const filePath = path.join(dir.local, file);
      if (fs.statSync(filePath).isDirectory()) continue;
      
      const destPath = `${dir.remote}/${file}`;
      const stat = fs.statSync(filePath);
      
      console.log(`Uploading ${file} (${(stat.size / 1024 / 1024).toFixed(1)}MB)...`);
      
      try {
        await client.uploadFromFilename(destPath, filePath);
        console.log(`✓ ${destPath}`);
        uploaded++;
      } catch (err) {
        console.error(`✗ Failed: ${err.message}`);
        failed++;
      }
    }
  }
  
  console.log(`\n✅ Uploaded: ${uploaded}, Failed: ${failed}`);
}

uploadAllMusic().catch(console.error);
