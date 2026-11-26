const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings (no time zone shifting).
types.setTypeParser(1082, (v) => v);

function createPool(connectionString) {
  return new Pool({ connectionString });
}

async function migrate(pool) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { createPool, migrate };
