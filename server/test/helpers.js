// Test database helper. Uses TEST_DATABASE_URL when set, otherwise starts a
// temporary embedded PostgreSQL (from the embedded-postgres dev dependency).
const os = require('os');
const fs = require('fs');
const path = require('path');
const { createPool, migrate } = require('../src/db');
const { createApp } = require('../src/app');

async function startDb() {
  if (process.env.TEST_DATABASE_URL) {
    const pool = createPool(process.env.TEST_DATABASE_URL);
    await migrate(pool);
    return { pool, stop: () => pool.end() };
  }
  const EmbeddedPostgres = (await import('embedded-postgres')).default;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweety-pg-'));
  const port = 54000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false, onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('sweety_test');
  const pool = createPool(`postgres://postgres:postgres@localhost:${port}/sweety_test`);
  await migrate(pool);
  return {
    pool,
    stop: async () => {
      await pool.end();
      await pg.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

const testConfig = { jwtSecret: 'test-secret', timezone: 'Asia/Kolkata', clientOrigin: 'http://localhost:5173' };

function buildApp(pool) {
  return createApp({ pool, config: testConfig });
}

async function resetTables(pool) {
  await pool.query('TRUNCATE readings, users RESTART IDENTITY CASCADE');
}

module.exports = { startDb, buildApp, resetTables, testConfig };
