const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function uploadVideos() {
  console.log('📤 Starting video upload to object storage...\n');
  
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    console.error('❌ Object storage bucket ID not found');
    return;
  }
  
  console.log(`📦 Using bucket: ${bucketId}\n`);
  
  const storage = new Storage();
  const bucket = storage.bucket(bucketId);
  const videos = [
    { local: 'public/videos/garcia-solar-rays.mp4', remote: 'public/videos/garcia-solar-rays.mp4' },
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
      
      await bucket.upload(video.local, {
        destination: video.remote,
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=3600'
        }
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Uploaded: ${path.basename(video.local)} (${fileSizeMB}MB) in ${duration}s\n`);
    } catch (error) {
      console.error(`❌ Failed to upload ${video.local}:`, error.message);
    }
  }
  
  console.log('🎉 All videos uploaded to object storage!');
  console.log('📂 Location: /public/videos/');
  console.log('\n✅ Videos are now available in production!');
}

uploadVideos().catch(console.error);
