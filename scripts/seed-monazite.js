#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

// Track data with proper metadata
const MONAZITE_TRACKS = [
  { file: 'public/music/monazite/01_Ternal_Flame_Longevity_Manifesto.mp3', title: 'Ternal Flame - Longevity Manifesto', duration: '4:38' },
  { file: 'public/music/monazite/02_David_Boyeez_Hair.mp3', title: 'David Boyeez Hair', duration: '5:51' },
  { file: 'public/music/monazite/03_Swampy_Boogie_Nights_Cajun_Crawler.mp3', title: 'Swampy Boogie Nights (Cajun Crawler)', duration: '5:26' },
  { file: 'public/music/monazite/04_The_Heart_is_a_Mule.mp3', title: 'The Heart is a Mule', duration: '5:38' },
  { file: 'public/music/monazite/05_A_Solar_Day_groovin.mp3', title: 'A Solar Day (groovin)', duration: '4:25' },
  { file: 'public/music/monazite/06_A_Solar_Day_moovin.mp3', title: 'A Solar Day (moovin)', duration: '5:56' },
  { file: 'public/music/monazite/07_Break_Time_Blues_Rhapsody.mp3', title: 'Break Time Blues Rhapsody', duration: '5:53' },
  { file: 'public/music/monazite/08_Starlight_Forever.mp3', title: 'Starlight Forever', duration: '5:31' },
  { file: 'public/music/monazite/09_Light_It_From_Within.mp3', title: 'Light It From Within', duration: '5:14' },
  { file: 'public/music/monazite/10_Moonshine_in_St_Kitts.mp3', title: 'Moonshine in St Kitts', duration: '4:23' },
  { file: 'public/music/monazite/11_Solar_Tempest_Symphony.mp3', title: 'Solar Tempest Symphony', duration: '2:45' },
  { file: 'public/music/monazite/12_Steel_In_His_Soul.mp3', title: 'Steel In His Soul', duration: '4:47' },
  { file: 'public/music/monazite/13_We_Said_So.mp3', title: 'We Said So', duration: '5:33' },
  { file: 'public/music/monazite/14_Funky_Voodoo_Blues_Jam.mp3', title: 'Funky Voodoo (Blues Jam)', duration: '5:27' },
  { file: 'public/music/monazite/15_Green_and_Blue_Rock.mp3', title: 'Green and Blue (Rock)', duration: '5:06' },
  { file: 'public/music/monazite/16_Green_and_Blue_EDM.mp3', title: 'Green and Blue (EDM)', duration: '3:52' },
  { file: 'public/music/monazite/17_Lady_Voodoo_Folk_Yah.mp3', title: 'Lady Voodoo (Folk Yah)', duration: '5:19' },
  { file: 'public/music/monazite/18_Lady_Voodoo_Crying.mp3', title: 'Lady Voodoo (Crying)', duration: '5:29' },
  { file: 'public/music/monazite/19_Rasta_Lady_Voodoo.mp3', title: 'Rasta Lady Voodoo', duration: '4:03' },
  { file: 'public/music/snowmancer-one.mp3', title: 'Snowmancer One (Market Exclusive)', duration: '4:15' }
];

const CREATOR_EMAIL = 'tdfranklin101@thecurrentsee.org';
const COLLECTION_NAME = 'monazite';

// Create slug from title
function createSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

// Calculate Solar price based on file size and energy estimation
function calculateSolarPrice(fileSize, duration) {
  // Base energy calculation: ~0.001 kWh per MB + duration factor
  const sizeInMB = fileSize / (1024 * 1024);
  const durationInMin = parseFloat(duration.split(':')[0]) + parseFloat(duration.split(':')[1]) / 60;
  
  // Energy estimation: file size impact + streaming/encoding energy
  const estimatedKwh = (sizeInMB * 0.001) + (durationInMin * 0.0005);
  
  // Convert to Solar tokens (0.8 multiplier for efficiency)
  const solarPrice = Math.max(0.12, Math.round(estimatedKwh * 0.8 * 10000) / 10000);
  
  return solarPrice;
}

// Generate unique artifact ID
function generateArtifactId() {
  return `mono_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create bundle ZIP file
async function createBundleZip() {
  console.log('📦 Creating Monazite Complete Collection bundle ZIP...');
  
  const zip = new AdmZip();
  const bundleDir = 'public/music/bundles';
  
  // Ensure bundle directory exists
  if (!fs.existsSync(bundleDir)) {
    fs.mkdirSync(bundleDir, { recursive: true });
  }
  
  let totalSize = 0;
  const trackList = [];
  
  // Add all tracks to ZIP
  for (let i = 0; i < MONAZITE_TRACKS.length; i++) {
    const track = MONAZITE_TRACKS[i];
    
    if (fs.existsSync(track.file)) {
      const fileName = `${String(i + 1).padStart(2, '0')}_${track.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.mp3`;
      const fileBuffer = fs.readFileSync(track.file);
      
      zip.addFile(fileName, fileBuffer);
      totalSize += fileBuffer.length;
      trackList.push({
        track: i + 1,
        title: track.title,
        duration: track.duration,
        filename: fileName
      });
      
      console.log(`   ✅ Added: ${track.title} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log(`   ❌ Missing: ${track.file}`);
    }
  }
  
  // Add track listing file
  const trackListingContent = `MONAZITE COMPLETE COLLECTION - Track Listing

🎵 Album: Monazite Complete Collection
🎯 Artist: TC-S Network  
💿 Total Tracks: ${trackList.length}
⚡ Solar-Powered Music Collection
🌱 Part of the TC-S Network renewable energy movement

Track List:
${trackList.map(t => `${t.track}. ${t.title} (${t.duration})`).join('\n')}

Total Bundle Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB

---
© TC-S Network - Solar-powered digital artifacts
Generated: ${new Date().toISOString()}
Creator: ${CREATOR_EMAIL}
`;

  zip.addFile('TRACK_LISTING.txt', Buffer.from(trackListingContent, 'utf8'));
  
  // Write ZIP file
  const zipPath = path.join(bundleDir, 'monazite-complete-collection.zip');
  zip.writeZip(zipPath);
  
  // Calculate SHA256 hash
  const zipBuffer = fs.readFileSync(zipPath);
  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  
  console.log(`✅ Bundle created: ${zipPath}`);
  console.log(`📊 Total size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🔐 SHA256: ${hash.substring(0, 16)}...`);
  
  return {
    path: zipPath,
    size: zipBuffer.length,
    hash: hash,
    trackCount: trackList.length
  };
}

// Generate marketplace manifest
async function generateMarketplaceManifest() {
  console.log('\n🏪 Generating marketplace manifest...');
  
  const artifacts = [];
  let totalValue = 0;
  
  // Process each track
  for (let i = 0; i < MONAZITE_TRACKS.length; i++) {
    const track = MONAZITE_TRACKS[i];
    
    if (fs.existsSync(track.file)) {
      const fileStats = fs.statSync(track.file);
      const solarPrice = calculateSolarPrice(fileStats.size, track.duration);
      const artifactId = generateArtifactId();
      
      const artifact = {
        id: artifactId,
        title: track.title,
        slug: createSlug(track.title),
        category: 'music',
        collection: COLLECTION_NAME,
        creatorEmail: CREATOR_EMAIL,
        filePath: track.file,
        priceSolar: solarPrice,
        energyKwh: (solarPrice / 0.8),
        durationSec: convertDurationToSeconds(track.duration),
        fileSize: fileStats.size,
        isActive: true,
        createdAt: new Date().toISOString(),
        trackNumber: i + 1,
        artist: 'TC-S Network',
        album: 'Monazite Complete Collection',
        genre: determineGenre(track.title),
        tags: ['monazite', 'solar', 'tc-s', 'original', 'renewable'],
        description: `Track ${i + 1} from the Monazite Collection. Original solar-powered music from the TC-S Network. ${track.duration} of renewable energy soundscapes.`
      };
      
      artifacts.push(artifact);
      totalValue += solarPrice;
      
      console.log(`   ✅ ${track.title} - ${solarPrice} Solar`);
    }
  }
  
  // Create bundle ZIP
  const bundleInfo = await createBundleZip();
  
  // Calculate bundle price (20% discount)
  const bundlePrice = Math.round(totalValue * 0.8 * 10000) / 10000;
  const savings = Math.round((totalValue - bundlePrice) * 10000) / 10000;
  
  // Create bundle artifact
  const bundleArtifact = {
    id: `bundle_monazite_complete_${Date.now()}`,
    title: 'Monazite Complete Collection (Album Bundle)',
    slug: 'monazite-complete-collection-bundle',
    category: 'music_bundle',
    collection: COLLECTION_NAME,
    creatorEmail: CREATOR_EMAIL,
    filePath: bundleInfo.path,
    priceSolar: bundlePrice,
    energyKwh: totalValue / 0.8,
    bundleSize: bundleInfo.size,
    trackCount: bundleInfo.trackCount,
    isActive: true,
    createdAt: new Date().toISOString(),
    type: 'album_bundle',
    artist: 'TC-S Network',
    album: 'Monazite Complete Collection',
    trackIds: artifacts.map(a => a.id),
    savings: savings,
    sha256: bundleInfo.hash,
    tags: ['monazite', 'album', 'bundle', 'complete', 'solar', 'tc-s', 'discount'],
    description: `🎵 COMPLETE MONAZITE COLLECTION - All ${artifacts.length} Tracks 🎵

The complete Monazite album from TC-S Network featuring ${artifacts.length} original solar-powered tracks. Diverse genres including ambient, rock, electronic, blues, and folk.

💰 Bundle Savings: ${savings} Solar (20% discount vs individual purchases)
📦 High-quality MP3 downloads with track listing
🌱 Renewable energy-inspired music collection

Individual tracks also available separately.`
  };
  
  // Create manifest directory
  const manifestDir = 'public/models';
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  
  // Write manifest file
  const manifest = {
    metadata: {
      collection: COLLECTION_NAME,
      creator: CREATOR_EMAIL,
      totalTracks: artifacts.length,
      totalValue: totalValue,
      bundlePrice: bundlePrice,
      savings: savings,
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    },
    artifacts: artifacts,
    bundles: [bundleArtifact]
  };
  
  const manifestPath = path.join(manifestDir, 'monazite-collection.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`\n📊 MONAZITE MARKETPLACE INTEGRATION COMPLETE`);
  console.log('=' .repeat(60));
  console.log(`✅ Individual Tracks: ${artifacts.length}`);
  console.log(`📦 Album Bundle: 1`);
  console.log(`💰 Total Collection Value: ${totalValue} Solar`);
  console.log(`🎯 Bundle Price: ${bundlePrice} Solar`);
  console.log(`💎 Bundle Savings: ${savings} Solar (20% off)`);
  console.log(`📁 Manifest: ${manifestPath}`);
  console.log(`🌐 Ready for marketplace integration!`);
  
  return manifest;
}

// Helper functions
function convertDurationToSeconds(duration) {
  const [minutes, seconds] = duration.split(':').map(Number);
  return (minutes * 60) + seconds;
}

function determineGenre(title) {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('blues') || lowerTitle.includes('voodoo')) return 'Blues';
  if (lowerTitle.includes('edm')) return 'Electronic';
  if (lowerTitle.includes('rock')) return 'Rock';
  if (lowerTitle.includes('folk')) return 'Folk';
  if (lowerTitle.includes('symphony')) return 'Classical';
  if (lowerTitle.includes('rasta')) return 'Reggae';
  return 'Alternative';
}

// Main execution
async function main() {
  console.log('🎵 MONAZITE MARKETPLACE SEEDING STARTING 🎵');
  console.log('=' .repeat(60));
  console.log(`📀 Collection: ${COLLECTION_NAME}`);
  console.log(`🎯 Creator: ${CREATOR_EMAIL}`);
  console.log(`🎵 Total Tracks: ${MONAZITE_TRACKS.length}`);
  console.log('=' .repeat(60));
  
  try {
    const manifest = await generateMarketplaceManifest();
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Integrate manifest into marketplace display system');
    console.log('2. Add secure download endpoints for purchases');
    console.log('3. Test purchase flow with Solar token transactions');
    console.log('4. Verify creator revenue distribution (85%)');
    
    return manifest;
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, MONAZITE_TRACKS, CREATOR_EMAIL };