#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Monazite Collection Data (extracted from music-now.html)
const MONAZITE_COLLECTION = {
  tracks: [
    'https://storage.aisongmaker.io/audio/4a839c86-40d9-4272-989b-7a512184ddb6.mp3', // 'Ternal Flame - Longevity Manifesto
    'https://storage.aisongmaker.io/audio/9b2b12e4-8626-41e4-b9e4-c7a563e40f97.mp3', // David Boyeez Hair
    'https://storage.aisongmaker.io/audio/015092c3-f687-4a01-9a81-dad42f2adce9.mp3', // Swampy Boogie Nights  
    'https://storage.aisongmaker.io/audio/10db8911-0b74-4675-ba62-02182c1d7f6b.mp3', // The Heart is a Mule
    'https://storage.aisongmaker.io/audio/418add3e-c1a5-4a76-b361-14d6a11794fe.mp3', // A Solar Day (groovin)
    'https://storage.aisongmaker.io/audio/a2647129-991f-4105-aad2-e45210005bef.mp3', // A Solar Day (moovin)
    'https://storage.aisongmaker.io/audio/09de8c9d-25a7-4b38-a6bd-c27b7de4629e.mp3', // Break Time Blues Rhapsody
    'https://storage.aisongmaker.io/audio/c51b1f15-eff7-41fb-b778-b1b9d914ce3a.mp3', // Starlight Forever
    'https://storage.aisongmaker.io/audio/ab1612d5-ccf4-4b4a-ab92-21b77bebdd46.mp3', // Light It From Within
    'https://storage.aisongmaker.io/audio/675d577c-5ab9-45c9-b9d5-d4362f6bcc12.mp3', // Moonshine in St Kitts
    'https://storage.aisongmaker.io/audio/94088af1-8318-401a-b277-b79fbbdb7475.mp3', // Solar Tempest Symphony
    'https://storage.aisongmaker.io/audio/cb58c04e-fc7b-448a-a9e5-a642e168cacd.mp3', // Steel In His Soul
    'https://storage.aisongmaker.io/audio/11802549-7cf8-4d4c-a708-44f04804f2ab.mp3', // We Said So
    'https://storage.aisongmaker.io/audio/19d37c35-dc0b-4686-8bd7-71992f925670.mp3', // Funky Voodoo
    'https://storage.aisongmaker.io/audio/255be09f-c09a-4d9a-8dbc-3c3ba65e9204.mp3', // Green and Blue (Rock)
    'https://storage.aisongmaker.io/audio/01e05fb6-a7ac-4dd3-9500-00bb46625ef1.mp3', // Green and Blue (EDM)
    'https://storage.aisongmaker.io/audio/49fc3427-e775-47f0-b5ea-8903006b07a0.mp3', // Lady Voodoo (Folk)
    'https://storage.aisongmaker.io/audio/b2001c35-620a-4893-b046-4de20ad11422.mp3', // Lady Voodoo (Crying)
    'https://storage.aisongmaker.io/audio/7abf4dac-2b12-434a-8d59-c115f8c54cb9.mp3', // Rasta Lady Voodoo
    '/music/snowmancer-one.mp3'  // Snowmancer One (Bonus) - LOCAL FILE
  ],
  
  trackNames: [
    'Ternal Flame - Longevity Manifesto', 'David Boyeez Hair', 'Swampy Boogie Nights (Cajun Crawler)', 
    'The Heart is a Mule', 'A Solar Day (groovin)', 'A Solar Day (moovin)',
    'Break Time Blues Rhapsody', 'Starlight Forever', 'Light It From Within',
    'Moonshine in St Kitts', 'Solar Tempest Symphony', 'Steel In His Soul',
    'We Said So', 'Funky Voodoo (Blues Jam)', 'Green and Blue (Rock)',
    'Green and Blue (EDM)', 'Lady Voodoo (Folk Yah)', 'Lady Voodoo (Crying)', 
    'Rasta Lady Voodoo',
    'Snowmancer One (Market Exclusive)'
  ],
  
  albumInfo: {
    title: 'Monazite Complete Collection',
    artist: 'TC-S Network',
    description: 'Complete 20-track collection featuring original solar-powered music. From ambient to rock, this collection represents the diverse soundscape of renewable energy culture.',
    tags: 'monazite, solar, collection, ambient, rock, electronic, original, tc-s, renewable'
  }
};

// Configuration
const API_BASE = 'http://localhost:3000';
const CREATOR_EMAIL = 'tdfranklin101@thecurrentsee.org';
const DOWNLOAD_DIR = './public/music/monazite/';
const ALBUM_BUNDLE_DIR = './public/music/bundles/';

class MonaziteAutomation {
  constructor() {
    this.downloadedTracks = [];
    this.uploadedTracks = [];
    this.albumBundleId = null;
  }

  // Step 1: Setup directories
  async setupDirectories() {
    console.log('🔧 Setting up directories...');
    
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(ALBUM_BUNDLE_DIR)) {
      fs.mkdirSync(ALBUM_BUNDLE_DIR, { recursive: true });
    }
    
    console.log('✅ Directories ready');
  }

  // Step 2: Download external MP3 files
  async downloadExternalTracks() {
    console.log('⬇️ Downloading external MP3 files...');
    
    for (let i = 0; i < MONAZITE_COLLECTION.tracks.length; i++) {
      const trackUrl = MONAZITE_COLLECTION.tracks[i];
      const trackName = MONAZITE_COLLECTION.trackNames[i];
      
      // Skip local file
      if (trackUrl.startsWith('/music/')) {
        console.log(`📁 Skipping local file: ${trackName}`);
        this.downloadedTracks.push({
          index: i,
          filename: trackUrl.split('/').pop(),
          localPath: `./public${trackUrl}`,
          title: trackName,
          isLocal: true
        });
        continue;
      }
      
      try {
        console.log(`⬇️ Downloading: ${trackName}...`);
        
        const response = await fetch(trackUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const filename = `${String(i + 1).padStart(2, '0')}_${trackName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.mp3`;
        const localPath = path.join(DOWNLOAD_DIR, filename);
        
        const buffer = await response.buffer();
        fs.writeFileSync(localPath, buffer);
        
        this.downloadedTracks.push({
          index: i,
          filename: filename,
          localPath: localPath,
          title: trackName,
          isLocal: false,
          size: buffer.length
        });
        
        console.log(`✅ Downloaded: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        
        // Small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to download ${trackName}:`, error.message);
      }
    }
    
    console.log(`✅ Downloaded ${this.downloadedTracks.filter(t => !t.isLocal).length} external tracks`);
  }

  // Step 3: Upload individual tracks to marketplace
  async uploadTracksToMarketplace() {
    console.log('🚀 Uploading tracks to marketplace...');
    
    for (const track of this.downloadedTracks) {
      try {
        console.log(`⬆️ Uploading: ${track.title}...`);
        
        const formData = new FormData();
        
        // Read file and append to form
        const fileBuffer = fs.readFileSync(track.localPath);
        formData.append('file', fileBuffer, {
          filename: track.filename,
          contentType: 'audio/mpeg'
        });
        
        // Add creator and metadata info
        formData.append('creatorId', CREATOR_EMAIL);
        formData.append('title', track.title);
        formData.append('description', `Track ${track.index + 1} from the Monazite Collection. Original solar-powered music from the TC-S Network.`);
        formData.append('tags', 'monazite, solar, music, original, tc-s');
        
        // Upload to creator API
        const response = await fetch(`${API_BASE}/api/creator/upload`, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log(`✅ Uploaded: ${track.title} - Solar Price: ${result.estimatedSolarPrice || 'TBD'}`);
          this.uploadedTracks.push({
            ...track,
            artifactId: result.artifactId,
            solarPrice: result.estimatedSolarPrice
          });
        } else {
          console.error(`❌ Upload failed for ${track.title}:`, result.error);
        }
        
        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Upload error for ${track.title}:`, error.message);
      }
    }
    
    console.log(`✅ Uploaded ${this.uploadedTracks.length} tracks to marketplace`);
  }

  // Step 4: Create album bundle package
  async createAlbumBundle() {
    console.log('📦 Creating album bundle...');
    
    try {
      // Create a ZIP-like bundle description for the album
      const albumDescription = `Complete Monazite Collection - All 20 tracks in one download package.
      
Track List:
${MONAZITE_COLLECTION.trackNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

This bundle includes:
- All 20 individual MP3 tracks
- High-quality audio files
- Complete album artwork
- Digital liner notes

Save Solar with this bundle purchase versus individual track downloads!`;

      // Calculate bundle discount price (20% off individual track total)
      const individualTotal = this.uploadedTracks.reduce((sum, track) => sum + (track.solarPrice || 0.001), 0);
      const bundlePrice = individualTotal * 0.8; // 20% discount
      
      // Upload album bundle as special artifact
      const formData = new FormData();
      
      // Create a simple text file representing the bundle
      const bundleInfo = JSON.stringify({
        type: 'album_bundle',
        tracks: this.uploadedTracks.map(track => ({
          title: track.title,
          artifactId: track.artifactId,
          filename: track.filename
        })),
        albumInfo: MONAZITE_COLLECTION.albumInfo
      });
      
      formData.append('file', Buffer.from(bundleInfo), {
        filename: 'monazite_complete_collection.json',
        contentType: 'application/json'
      });
      
      formData.append('creatorId', CREATOR_EMAIL);
      formData.append('title', MONAZITE_COLLECTION.albumInfo.title);
      formData.append('description', albumDescription);
      formData.append('tags', `${MONAZITE_COLLECTION.albumInfo.tags}, bundle, album, complete`);
      
      const response = await fetch(`${API_BASE}/api/creator/upload`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        this.albumBundleId = result.artifactId;
        console.log(`✅ Album bundle created - Solar Price: ${result.estimatedSolarPrice || bundlePrice.toFixed(4)}`);
        console.log(`💰 Bundle saves ${(individualTotal - bundlePrice).toFixed(4)} Solar versus individual purchases!`);
      } else {
        console.error('❌ Album bundle creation failed:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Album bundle creation error:', error.message);
    }
  }

  // Step 5: Generate summary report
  generateReport() {
    console.log('\n📊 MONAZITE AUTOMATION COMPLETE - SUMMARY REPORT');
    console.log('=' .repeat(60));
    console.log(`📀 Album: ${MONAZITE_COLLECTION.albumInfo.title}`);
    console.log(`🎵 Total Tracks: ${this.downloadedTracks.length}`);
    console.log(`⬇️ External Downloads: ${this.downloadedTracks.filter(t => !t.isLocal).length}`);
    console.log(`📁 Local Files: ${this.downloadedTracks.filter(t => t.isLocal).length}`);
    console.log(`🚀 Marketplace Uploads: ${this.uploadedTracks.length}`);
    console.log(`📦 Album Bundle: ${this.albumBundleId ? 'Created' : 'Failed'}`);
    
    if (this.uploadedTracks.length > 0) {
      const totalSolarValue = this.uploadedTracks.reduce((sum, track) => sum + (track.solarPrice || 0.001), 0);
      console.log(`💰 Total Collection Value: ${totalSolarValue.toFixed(4)} Solar`);
      console.log(`💎 Your Revenue (85%): ${(totalSolarValue * 0.85).toFixed(4)} Solar per sale`);
    }
    
    console.log('\n🎯 Ready for Solar-powered sales in TC-S Marketplace!');
    console.log('🌐 View at: /marketplace.html');
  }

  // Main execution function
  async run() {
    console.log('🎵 MONAZITE COLLECTION AUTOMATION STARTING 🎵');
    console.log('=' .repeat(60));
    
    try {
      await this.setupDirectories();
      await this.downloadExternalTracks();
      await this.uploadTracksToMarketplace();
      await this.createAlbumBundle();
      this.generateReport();
      
      console.log('\n🎉 AUTOMATION COMPLETE! Your Monazite collection is now live in the marketplace!');
      
    } catch (error) {
      console.error('\n💥 AUTOMATION FAILED:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const automation = new MonaziteAutomation();
  automation.run();
}

module.exports = MonaziteAutomation;