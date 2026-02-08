const fs = require('fs');
const path = require('path');
const cloudStorage = require('../server/cloud-storage');

const STORAGE_DIR = path.join(__dirname, '../storage');
const PREVIEWS_DIR = path.join(__dirname, '../public/previews');

async function migrateFiles() {
  if (!cloudStorage.isAvailable()) {
    console.error('Object storage is not available. Cannot migrate.');
    process.exit(1);
  }

  const results = { uploaded: 0, failed: 0, skipped: 0 };

  const masterDir = path.join(STORAGE_DIR, 'master');
  if (fs.existsSync(masterDir)) {
    const files = fs.readdirSync(masterDir);
    for (const file of files) {
      const localPath = path.join(masterDir, file);
      const key = `${process.env.PRIVATE_OBJECT_DIR || '.private'}/master/${file}`;
      try {
        const result = await cloudStorage.migrateLocalFile(localPath, key);
        console.log(`  [master] ${file} -> ${result.key} (${result.size} bytes)`);
        results.uploaded++;
      } catch (err) {
        console.error(`  [master] FAILED ${file}: ${err.message}`);
        results.failed++;
      }
    }
  }

  const tradeDir = path.join(STORAGE_DIR, 'trade');
  if (fs.existsSync(tradeDir)) {
    const files = fs.readdirSync(tradeDir);
    for (const file of files) {
      const localPath = path.join(tradeDir, file);
      const key = `${process.env.PRIVATE_OBJECT_DIR || '.private'}/trade/${file}`;
      try {
        const result = await cloudStorage.migrateLocalFile(localPath, key);
        console.log(`  [trade] ${file} -> ${result.key} (${result.size} bytes)`);
        results.uploaded++;
      } catch (err) {
        console.error(`  [trade] FAILED ${file}: ${err.message}`);
        results.failed++;
      }
    }
  }

  if (fs.existsSync(PREVIEWS_DIR)) {
    const files = fs.readdirSync(PREVIEWS_DIR);
    for (const file of files) {
      const localPath = path.join(PREVIEWS_DIR, file);
      const key = `public/previews/${file}`;
      try {
        const result = await cloudStorage.migrateLocalFile(localPath, key);
        console.log(`  [preview] ${file} -> ${result.key} (${result.size} bytes)`);
        results.uploaded++;
      } catch (err) {
        console.error(`  [preview] FAILED ${file}: ${err.message}`);
        results.failed++;
      }
    }
  }

  console.log(`\nMigration complete: ${results.uploaded} uploaded, ${results.failed} failed, ${results.skipped} skipped`);

  if (process.argv.includes('--update-db')) {
    await updateDatabaseUrls();
  }
}

async function updateDatabaseUrls() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query(
      `SELECT id, master_file_url, preview_file_url, trade_file_url FROM artifacts WHERE master_file_url LIKE '/api/files/secure/%' OR master_file_url LIKE '/storage/%'`
    );

    console.log(`\nUpdating ${rows.length} artifact DB records...`);

    for (const row of rows) {
      const artifactId = row.id;
      const masterKey = await findCloudKey('master', artifactId);
      const tradeKey = await findCloudKey('trade', artifactId);
      const previewKey = await findCloudKey('preview', artifactId);

      if (masterKey || tradeKey || previewKey) {
        const updates = [];
        const values = [];
        let idx = 1;

        if (masterKey) {
          updates.push(`master_file_url = $${idx++}`);
          values.push(`cloud://${masterKey}`);
        }
        if (tradeKey) {
          updates.push(`trade_file_url = $${idx++}`);
          values.push(`cloud://${tradeKey}`);
        }
        if (previewKey) {
          updates.push(`preview_file_url = $${idx++}`);
          values.push(`cloud://${previewKey}`);
        }

        values.push(artifactId);
        await pool.query(
          `UPDATE artifacts SET ${updates.join(', ')} WHERE id = $${idx}`,
          values
        );
        console.log(`  Updated ${artifactId}: master=${!!masterKey} trade=${!!tradeKey} preview=${!!previewKey}`);
      }
    }
  } finally {
    await pool.end();
  }
}

async function findCloudKey(fileType, artifactId) {
  const extensions = ['.png', '.jpg', '.jpeg', '.mp3', '.wav', '.mp4', '.txt', '.json', '.bin'];
  const privateDir = process.env.PRIVATE_OBJECT_DIR || '.private';

  for (const ext of extensions) {
    const key = fileType === 'preview'
      ? `public/previews/${artifactId}_preview${ext}`
      : `${privateDir}/${fileType}/${artifactId}_${fileType}${ext}`;
    try {
      const exists = await cloudStorage.fileExists(key);
      if (exists) return key;
    } catch { continue; }
  }
  return null;
}

migrateFiles().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
