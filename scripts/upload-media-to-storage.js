const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');

async function uploadMedia() {
  const client = new Client();
  const mediaDir = path.join(__dirname, '..', 'public', 'media');
  
  const files = fs.readdirSync(mediaDir).filter(f => f.endsWith('.mp3'));
  
  for (const file of files) {
    const filePath = path.join(mediaDir, file);
    const destPath = `public/media/${file}`;
    
    const stat = fs.statSync(filePath);
    console.log(`Uploading ${file} (${(stat.size / 1024 / 1024).toFixed(1)}MB)...`);
    
    try {
      await client.uploadFromFilename(destPath, filePath);
      console.log(`✓ Uploaded to ${destPath}`);
    } catch (err) {
      console.error(`✗ Failed: ${err.message}`);
    }
  }
}

uploadMedia().then(() => console.log('Done!')).catch(console.error);
