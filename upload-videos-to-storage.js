const { Client } = require('@replit/object-storage');
const fs = require('fs');
const path = require('path');

async function uploadVideos() {
  console.log('📤 Starting video upload to object storage...\n');
  
  const client = new Client();
  
  const videos = [
    { local: 'public/videos/plant-the-seed.mp4', remote: 'public/videos/plant-the-seed.mp4' },
    { local: 'public/videos/podcast-discussion.mp4', remote: 'public/videos/podcast-discussion.mp4' },
    { local: 'public/videos/we-said-so-monazite.mp4', remote: 'public/videos/we-said-so-monazite.mp4' }
  ];
  
  for (const video of videos) {
    try {
      console.log(`⏳ Uploading: ${path.basename(video.local)}...`);
      const startTime = Date.now();
      
      const stats = fs.statSync(video.local);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(1);
      
      const fileData = fs.readFileSync(video.local);
      await client.uploadFromBytes(video.remote, fileData);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Uploaded: ${path.basename(video.local)} (${fileSizeMB}MB) in ${duration}s\n`);
    } catch (error) {
      console.error(`❌ Failed to upload ${video.local}:`, error.message);
      console.error('   Error details:', error);
    }
  }
  
  console.log('🎉 All videos uploaded to object storage!');
  console.log('📂 Location: /public/videos/');
  console.log('\n✅ Videos are now available in production!');
}

uploadVideos().catch(console.error);
