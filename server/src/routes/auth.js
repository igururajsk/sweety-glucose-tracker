const express = require('express');
const bcrypt = require('bcryptjs');
const { validateSignup } = require('../lib/validation');
const { signToken, requireAuth } = require('../middleware/auth');

module.exports = function authRoutes({ pool, config }) {
  const router = express.Router();

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

  router.post('/signup', async (req, res) => {
    const errors = validateSignup(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: Object.values(errors)[0], errors });
    }
    const name = String(req.body.name).trim();
    const email = String(req.body.email).trim().toLowerCase();
    const hash = await bcrypt.hash(String(req.body.password), 10);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, hash],
      );
      res.status(201).json({ token: signToken(rows[0], config.jwtSecret), user: publicUser(rows[0]) });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists.', errors: { email: 'An account with this email already exists.' } });
      }
      throw err;
    }
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    // Same message for unknown email and wrong password.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    res.json({ token: signToken(user, config.jwtSecret), user: publicUser(user) });
  });

  router.get('/me', requireAuth(config.jwtSecret), async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Please log in.' });
    res.json({ user: rows[0] });
  });

  return router;
};
