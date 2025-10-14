const { Pool } = require('pg');

// Production database connection
const prodPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_LmeP4pSzVNh3@ep-polished-truth-a6ufj6np.us-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function migrateMembers() {
  try {
    console.log('🔄 Migrating members to production database...');
    
    // Insert the 2 members
    const insertQuery = `
      INSERT INTO members (id, username, name, email, first_name, last_name, password_hash, total_solar, total_dollars, joined_date, last_distribution_date, signup_timestamp, is_anonymous, is_reserve, is_placeholder)
      VALUES 
        (21, 'tdfranklin101', 'TD Franklin', 'tdfranklin101@thecurrentsee.org', 'TD', 'Franklin', '$2b$12$jYAUNfrvD/MXHlSdEVLMDO7c8DkYYVJb5Tj3YTK0eC2PEGpmCYOku', 189.0000, 0.00, '2025-09-24T12:53:00Z', '2025-10-10 03:02:10.444823+00', '2025-09-24 18:02:45.428993', false, false, false),
        (30, 'Jennmarie27', 'Jennmarie Franklin', 'aunsun27@icloud.com', 'Jennmarie', 'Franklin', '$2b$12$ONlIXlXYBTrSJAqm3a7zXOYr3ta3zAFhPxQdDxXSAy5NoeCoAH48q', 189.0000, 0.00, '2025-10-02T03:09:33.935Z', '2025-10-10 03:02:10.444823+00', '2025-10-02 03:09:33.935', false, false, false)
      ON CONFLICT (id) DO NOTHING;
    `;
    
    await prodPool.query(insertQuery);
    console.log('✅ Members inserted successfully');
    
    // Verify
    const verifyQuery = 'SELECT username, total_solar, email FROM members WHERE is_placeholder = false';
    const result = await prodPool.query(verifyQuery);
    
    console.log('\n📊 Production members:');
    result.rows.forEach(member => {
      console.log(`  - ${member.username}: ${member.total_solar} Solar (${member.email})`);
    });
    
    await prodPool.end();
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await prodPool.end();
    process.exit(1);
  }
}

migrateMembers();
