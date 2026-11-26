const config = require('./config');
const { createPool, migrate } = require('./db');

(async () => {
  const pool = createPool(config.databaseUrl);
  try {
    await migrate(pool);
    console.log('Database schema is up to date.');
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
