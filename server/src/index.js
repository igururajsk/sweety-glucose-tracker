const config = require('./config');
const { createPool, migrate } = require('./db');
const { createApp } = require('./app');

(async () => {
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  createApp({ pool, config }).listen(config.port, () => {
    console.log(`Sweety API listening on http://localhost:${config.port}`);
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
