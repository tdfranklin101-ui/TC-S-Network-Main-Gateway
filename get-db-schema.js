const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.CURRENTSEE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Getting members table schema...');
    
    const { rows } = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'members'
      ORDER BY ordinal_position;
    `);
    
    console.log('Members table schema:');
    for (const row of rows) {
      console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})${row.column_default ? ' DEFAULT ' + row.column_default : ''}`);
    }
    
    // Also get a sample row
    const { rows: sampleRows } = await pool.query('SELECT * FROM members LIMIT 1');
    if (sampleRows.length > 0) {
      console.log('\nSample member data:');
      console.log(JSON.stringify(sampleRows[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();