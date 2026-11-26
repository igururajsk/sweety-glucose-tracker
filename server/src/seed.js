// Creates a demo user (demo@sweety.test / demo1234) with about six weeks of sample readings.
const bcrypt = require('bcryptjs');
const config = require('./config');
const { createPool, migrate } = require('./db');
const { SLOT_KEYS } = require('./lib/slots');
const { todayIn } = require('./lib/dates');

const DEMO = { name: 'Demo Patient', email: 'demo@sweety.test', password: 'demo1234' };

// Simple deterministic pseudo-random numbers so the seed data is the same every run.
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function seed(pool, today = todayIn(config.timezone)) {
  await migrate(pool);
  await pool.query('DELETE FROM users WHERE email = $1', [DEMO.email]);
  const hash = await bcrypt.hash(DEMO.password, 10);
  const { rows } = await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', [DEMO.name, DEMO.email, hash]);
  const userId = rows[0].id;

  const rng = makeRng(42);
  const base = { morning: 105, after_breakfast: 145, after_lunch: 140, after_dinner: 150 };
  const [y, m, d] = today.split('-').map(Number);
  let inserted = 0;
  for (let back = 0; back < 45; back++) {
    const day = new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
    for (const slot of SLOT_KEYS) {
      // Skip some readings so there are days with fewer than 4.
      if (back === 0 ? slot !== 'morning' : rng() < 0.15) continue;
      const value = Math.round(base[slot] + (rng() - 0.5) * 50);
      await pool.query('INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4)', [userId, day, slot, value]);
      inserted++;
    }
  }
  return { userId, inserted };
}

module.exports = { seed, DEMO };

if (require.main === module) {
  const pool = createPool(config.databaseUrl);
  seed(pool)
    .then(({ inserted }) => console.log(`Seeded ${DEMO.email} / ${DEMO.password} with ${inserted} readings.`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
