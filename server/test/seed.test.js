const test = require('node:test');
const assert = require('node:assert/strict');
const { startDb } = require('./helpers');
const { seed, DEMO } = require('../src/seed');

test('seed script creates a demo user with readings and can be re-run', async () => {
  const db = await startDb();
  try {
    await db.pool.query('TRUNCATE readings, users RESTART IDENTITY CASCADE');
    const first = await seed(db.pool, '2026-11-20');
    assert.ok(first.inserted > 50);
    const second = await seed(db.pool, '2026-11-20');
    assert.equal(second.inserted, first.inserted);
    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM users WHERE email = $1', [DEMO.email]);
    assert.equal(rows[0].n, 1);
  } finally {
    await db.stop();
  }
});
