const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const readingRoutes = require('./routes/readings');
const reportRoutes = require('./routes/reports');

function createApp({ pool, config }) {
  const app = express();
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/auth', authRoutes({ pool, config }));
  const auth = requireAuth(config.jwtSecret);
  app.use('/readings', auth, readingRoutes({ pool, config }));
  app.use('/reports', auth, reportRoutes({ pool, config }));

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}

module.exports = { createApp };
