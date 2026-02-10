const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const cloudStorage = require('./cloud-storage');

const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';

const TITLE_TO_FILE = {
  "'Ternal Flame": 'public/music/monazite/01_Ternal_Flame_Longevity_Manifesto.mp3',
  'David Boyeez Hair': 'public/music/monazite/02_David_Boyeez_Hair.mp3',
  'Swampy Boogie Nights': 'public/music/monazite/03_Swampy_Boogie_Nights_Cajun_Crawler.mp3',
  'The Heart is a Mule': 'public/music/monazite/04_The_Heart_is_a_Mule.mp3',
  'A Solar Day (groovin)': 'public/music/monazite/05_A_Solar_Day_groovin.mp3',
  'A Solar Day (moovin)': 'public/music/monazite/06_A_Solar_Day_moovin.mp3',
  'Break Time Blues Rhapsody': 'public/music/monazite/07_Break_Time_Blues_Rhapsody.mp3',
  'Starlight Forever': 'public/music/monazite/08_Starlight_Forever.mp3',
  'Light It From Within': 'public/music/monazite/09_Light_It_From_Within.mp3',
  'Moonshine in Saint Kitts': 'public/music/monazite/10_Moonshine_in_St_Kitts.mp3',
  'Solar Tempest': 'public/music/monazite/11_Solar_Tempest_Symphony.mp3',
  'Steel In His Soul': 'public/music/monazite/12_Steel_In_His_Soul.mp3',
  'We Said So': 'public/music/monazite/13_We_Said_So.mp3',
  'Funky Voodoo Blues Jam': 'public/music/monazite/14_Funky_Voodoo_Blues_Jam.mp3',
  'Green and Blue Rock': 'public/music/monazite/15_Green_and_Blue_Rock.mp3',
  'Green and Blue EDM': 'public/music/monazite/16_Green_and_Blue_EDM.mp3',
  'Lady Voodoo Folk Yah': 'public/music/monazite/17_Lady_Voodoo_Folk_Yah.mp3',
  'Lady Voodoo Crying': 'public/music/monazite/18_Lady_Voodoo_Crying.mp3',
  'Rasta Lady Voodoo': 'public/music/monazite/19_Rasta_Lady_Voodoo.mp3',
  'Snowmancer One': 'public/music/snowmancer-one.mp3',
  'Break on the Bright Side - Batrhyme': 'public/media/batrhyme-break-on-the-bright-side.mp3',
  'Exclusive Track #2': 'public/music/monazite/19_Rasta_Lady_Voodoo.mp3',
  'Exclusive Track #3': 'public/music/monazite/19_Rasta_Lady_Voodoo.mp3',
  'Exclusive Track #4': 'public/music/monazite/19_Rasta_Lady_Voodoo.mp3',
};

function generatePreview(inputPath, artifactId) {
  const tmpOutput = path.join('/tmp', `${artifactId}_preview.mp3`);
  let durationSec = 0;
  try {
    const probe = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${inputPath}"`,
      { encoding: 'utf8' }
    ).trim();
    durationSec = parseFloat(probe) || 0;
  } catch {
    durationSec = 0;
  }

  const startSec = durationSec > 45 ? 15 : 0;
  const clipDuration = 30;

  execSync(
    `ffmpeg -y -i "${inputPath}" -ss ${startSec} -t ${clipDuration} -ab 128k -f mp3 "${tmpOutput}"`,
    { stdio: 'pipe' }
  );

  const buffer = fs.readFileSync(tmpOutput);
  try { fs.unlinkSync(tmpOutput); } catch {}
  return buffer;
}

async function main() {
  console.log('=== Music Files Backfill Script ===\n');

  if (!cloudStorage.isAvailable()) {
    console.error('Object storage is not available. Exiting.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: artifacts } = await pool.query(
      `SELECT id, title, master_file_url FROM artifacts
       WHERE title = ANY($1)
       ORDER BY title`,
      [Object.keys(TITLE_TO_FILE)]
    );

    console.log(`Found ${artifacts.length} artifacts to process.\n`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const artifact of artifacts) {
      const { id, title, master_file_url } = artifact;

      if (master_file_url && master_file_url.startsWith('cloud://')) {
        console.log(`SKIP: "${title}" — already has cloud URL`);
        skipped++;
        continue;
      }

      const relPath = TITLE_TO_FILE[title];
      if (!relPath) {
        console.log(`SKIP: "${title}" — no file mapping found`);
        skipped++;
        continue;
      }

      const filePath = path.resolve(__dirname, '..', relPath);
      if (!fs.existsSync(filePath)) {
        console.error(`FAIL: "${title}" — file not found: ${filePath}`);
        failed++;
        continue;
      }

      console.log(`Processing: "${title}" (${id})`);

      try {
        const fileBuffer = fs.readFileSync(filePath);
        console.log(`  Read ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        const masterResult = await cloudStorage.uploadMasterFile(id, '.mp3', fileBuffer);
        console.log(`  Master uploaded: ${masterResult.key}`);

        const tradeResult = await cloudStorage.uploadTradeFile(id, '.mp3', fileBuffer);
        console.log(`  Trade uploaded: ${tradeResult.key}`);

        console.log(`  Generating preview...`);
        const previewBuffer = generatePreview(filePath, id);
        const previewKey = `${PRIVATE_DIR}/preview/${id}_preview.mp3`;
        const previewResult = await cloudStorage.uploadFromBuffer(previewKey, previewBuffer);
        console.log(`  Preview uploaded: ${previewResult.key} (${(previewBuffer.length / 1024).toFixed(1)} KB)`);

        await pool.query(
          `UPDATE artifacts SET
            master_file_url = $1,
            trade_file_url = $2,
            preview_file_url = $3,
            file_type = 'audio/mpeg',
            master_file_size = $4,
            trade_file_size = $5,
            preview_file_size = $6,
            processing_status = 'completed'
          WHERE id = $7`,
          [
            `cloud://${masterResult.key}`,
            `cloud://${tradeResult.key}`,
            `cloud://${previewResult.key}`,
            masterResult.size,
            tradeResult.size,
            previewResult.size,
            id,
          ]
        );

        console.log(`  DB updated. Done.\n`);
        processed++;
      } catch (err) {
        console.error(`  FAIL: ${err.message}\n`);
        await pool.query(
          `UPDATE artifacts SET processing_status = 'failed', processing_error = $1 WHERE id = $2`,
          [err.message, id]
        );
        failed++;
      }
    }

    console.log('=== Summary ===');
    console.log(`Processed: ${processed}`);
    console.log(`Skipped:   ${skipped}`);
    console.log(`Failed:    ${failed}`);
    console.log(`Total:     ${artifacts.length}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
