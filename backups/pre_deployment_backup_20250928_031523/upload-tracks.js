#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Track information from your collection
const TRACKS = [
  { file: './public/music/monazite/01_Ternal_Flame_Longevity_Manifesto.mp3', title: 'Ternal Flame - Longevity Manifesto' },
  { file: './public/music/monazite/02_David_Boyeez_Hair.mp3', title: 'David Boyeez Hair' },
  { file: './public/music/monazite/03_Swampy_Boogie_Nights_Cajun_Crawler.mp3', title: 'Swampy Boogie Nights (Cajun Crawler)' },
  { file: './public/music/monazite/04_The_Heart_is_a_Mule.mp3', title: 'The Heart is a Mule' },
  { file: './public/music/monazite/05_A_Solar_Day_groovin.mp3', title: 'A Solar Day (groovin)' },
  { file: './public/music/monazite/06_A_Solar_Day_moovin.mp3', title: 'A Solar Day (moovin)' },
  { file: './public/music/monazite/07_Break_Time_Blues_Rhapsody.mp3', title: 'Break Time Blues Rhapsody' },
  { file: './public/music/monazite/08_Starlight_Forever.mp3', title: 'Starlight Forever' },
  { file: './public/music/monazite/09_Light_It_From_Within.mp3', title: 'Light It From Within' },
  { file: './public/music/monazite/10_Moonshine_in_St_Kitts.mp3', title: 'Moonshine in St Kitts' },
  { file: './public/music/monazite/11_Solar_Tempest_Symphony.mp3', title: 'Solar Tempest Symphony' },
  { file: './public/music/monazite/12_Steel_In_His_Soul.mp3', title: 'Steel In His Soul' },
  { file: './public/music/monazite/13_We_Said_So.mp3', title: 'We Said So' },
  { file: './public/music/monazite/14_Funky_Voodoo_Blues_Jam.mp3', title: 'Funky Voodoo (Blues Jam)' },
  { file: './public/music/monazite/15_Green_and_Blue_Rock.mp3', title: 'Green and Blue (Rock)' },
  { file: './public/music/monazite/16_Green_and_Blue_EDM.mp3', title: 'Green and Blue (EDM)' },
  { file: './public/music/monazite/17_Lady_Voodoo_Folk_Yah.mp3', title: 'Lady Voodoo (Folk Yah)' },
  { file: './public/music/monazite/18_Lady_Voodoo_Crying.mp3', title: 'Lady Voodoo (Crying)' },
  { file: './public/music/monazite/19_Rasta_Lady_Voodoo.mp3', title: 'Rasta Lady Voodoo' },
  { file: './public/music/snowmancer-one.mp3', title: 'Snowmancer One (Market Exclusive)' }
];

const CREATOR_EMAIL = 'tdfranklin101@thecurrentsee.org';
const API_BASE = 'http://localhost:3000';

async function uploadTrack(track, index) {
  console.log(`⬆️ [${index + 1}/20] Uploading: ${track.title}...`);
  
  try {
    if (!fs.existsSync(track.file)) {
      console.log(`❌ File not found: ${track.file}`);
      return null;
    }
    
    const formData = new FormData();
    const fileStream = fs.createReadStream(track.file);
    const filename = path.basename(track.file);
    
    formData.append('file', fileStream, filename);
    formData.append('creatorId', CREATOR_EMAIL);
    formData.append('title', track.title);
    formData.append('description', `Track ${index + 1} from the Monazite Collection. Original solar-powered music from the TC-S Network. Part of a 20-track album showcasing diverse renewable energy soundscapes.`);
    formData.append('tags', 'monazite, solar, music, original, tc-s, renewable, album');
    
    const response = await fetch(`${API_BASE}/api/creator/upload`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ [${index + 1}/20] Uploaded: ${track.title}`);
      console.log(`   💰 Solar Price: ${result.estimatedSolarPrice || 'Calculating...'}`);
      console.log(`   📁 File ID: ${result.artifactId || 'Generated'}`);
      return result;
    } else {
      console.log(`❌ [${index + 1}/20] Failed: ${track.title} - ${result.error}`);
      return null;
    }
    
  } catch (error) {
    console.log(`❌ [${index + 1}/20] Error: ${track.title} - ${error.message}`);
    return null;
  }
}

async function createAlbumBundle(uploadedTracks) {
  console.log('\n📦 Creating album bundle...');
  
  try {
    const bundleDescription = `🎵 MONAZITE COMPLETE COLLECTION - All 20 Tracks 🎵

The complete Monazite album from TC-S Network featuring:
• 20 original solar-powered tracks
• Diverse genres: ambient, rock, electronic, blues, folk
• High-quality MP3 downloads
• Renewable energy-inspired music

Individual tracks available separately or save Solar with this bundle!

Track List:
${TRACKS.map((track, i) => `${i + 1}. ${track.title}`).join('\n')}

🌱 Part of the TC-S Network renewable energy music movement
💰 Bundle discount: Save 20% versus individual track purchases`;

    // Calculate bundle price (20% discount)
    const individualTotal = uploadedTracks.reduce((sum, result) => {
      return sum + (result?.estimatedSolarPrice || 0.001);
    }, 0);
    const bundlePrice = individualTotal * 0.8;
    
    const bundleInfo = {
      type: 'album_bundle',
      albumTitle: 'Monazite Complete Collection',
      artist: 'TC-S Network',
      trackCount: uploadedTracks.length,
      tracks: uploadedTracks.map(result => ({
        title: result?.title || 'Unknown',
        artifactId: result?.artifactId || null
      })),
      savings: individualTotal - bundlePrice,
      bundlePrice: bundlePrice
    };
    
    const formData = new FormData();
    formData.append('file', Buffer.from(JSON.stringify(bundleInfo, null, 2)), {
      filename: 'monazite_complete_collection_bundle.json',
      contentType: 'application/json'
    });
    
    formData.append('creatorId', CREATOR_EMAIL);
    formData.append('title', 'Monazite Complete Collection (Album Bundle)');
    formData.append('description', bundleDescription);
    formData.append('tags', 'monazite, solar, album, bundle, complete, collection, tc-s, music, discount');
    
    const response = await fetch(`${API_BASE}/api/creator/upload`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Album bundle created successfully!`);
      console.log(`   💰 Bundle Price: ${result.estimatedSolarPrice || bundlePrice.toFixed(4)} Solar`);
      console.log(`   💎 You Save: ${(individualTotal - bundlePrice).toFixed(4)} Solar vs individual`);
      console.log(`   📦 Bundle ID: ${result.artifactId || 'Generated'}`);
      return result;
    } else {
      console.log(`❌ Album bundle creation failed: ${result.error}`);
      return null;
    }
    
  } catch (error) {
    console.log(`❌ Album bundle error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🎵 MONAZITE COLLECTION UPLOAD STARTING 🎵');
  console.log('=' .repeat(60));
  console.log(`📀 Album: Monazite Complete Collection`);
  console.log(`🎯 Creator: ${CREATOR_EMAIL}`);
  console.log(`🎵 Total Tracks: ${TRACKS.length}`);
  console.log('=' .repeat(60));
  
  const uploadResults = [];
  let successCount = 0;
  let failCount = 0;
  
  // Upload individual tracks
  for (let i = 0; i < TRACKS.length; i++) {
    const result = await uploadTrack(TRACKS[i], i);
    uploadResults.push(result);
    
    if (result) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 TRACK UPLOAD SUMMARY');
  console.log('=' .repeat(40));
  console.log(`✅ Successful uploads: ${successCount}`);
  console.log(`❌ Failed uploads: ${failCount}`);
  console.log(`📈 Success rate: ${((successCount / TRACKS.length) * 100).toFixed(1)}%`);
  
  // Create album bundle if we have successful uploads
  let bundleResult = null;
  if (successCount > 0) {
    const validUploads = uploadResults.filter(r => r !== null);
    bundleResult = await createAlbumBundle(validUploads);
  }
  
  // Final summary
  console.log('\n🎉 MONAZITE UPLOAD COMPLETE!');
  console.log('=' .repeat(60));
  console.log(`🎵 Individual Tracks: ${successCount}/${TRACKS.length} uploaded`);
  console.log(`📦 Album Bundle: ${bundleResult ? 'Created' : 'Failed'}`);
  
  if (successCount > 0) {
    const totalValue = uploadResults
      .filter(r => r !== null)
      .reduce((sum, r) => sum + (r.estimatedSolarPrice || 0.001), 0);
    
    console.log(`💰 Total Collection Value: ${totalValue.toFixed(4)} Solar`);
    console.log(`💎 Your Revenue (85%): ${(totalValue * 0.85).toFixed(4)} Solar per sale`);
    console.log(`🌐 View in marketplace: http://localhost:3000/marketplace.html`);
  }
  
  console.log('\n🚀 Your Monazite collection is now live and earning Solar tokens!');
}

// Run the upload
main().catch(console.error);