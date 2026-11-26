const express = require('express');
const { validateReadingInput } = require('../lib/validation');
const { todayIn, isValidDateString } = require('../lib/dates');
const { SLOTS } = require('../lib/slots');

const MAX_PER_DAY = 4;

const toApi = (r) => ({ id: r.id, date: r.reading_date, slot: r.slot, slotLabel: SLOTS[r.slot], value: r.value });

module.exports = function readingRoutes({ pool, config }) {
  const router = express.Router();
  const today = () => todayIn(config.timezone);

  /**
   * Checks that need the database: one reading per slot per day, max 4 per day.
   * `excludeId` lets an edit ignore the reading being edited.
   */
  async function checkDayRules(userId, { date, slot }, excludeId = null) {
    const { rows } = await pool.query(
      'SELECT id, slot FROM readings WHERE user_id = $1 AND reading_date = $2 AND ($3::int IS NULL OR id <> $3)',
      [userId, date, excludeId],
    );
    if (rows.some((r) => r.slot === slot)) {
      return { slot: `You already have an ${SLOTS[slot]} reading for this date.` };
    }
    if (rows.length >= MAX_PER_DAY) {
      return { date: `You can add only ${MAX_PER_DAY} readings per day.` };
    }
    return null;
  }

  const fail = (res, errors, status = 400) => res.status(status).json({ error: Object.values(errors)[0], errors });

  // List own readings, newest first. Supports ?page=1&limit=20, ?from= and ?to= (YYYY-MM-DD).
  router.get('/', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const where = ['user_id = $1'];
    const params = [req.userId];
    if (req.query.from && isValidDateString(req.query.from)) {
      params.push(req.query.from);
      where.push(`reading_date >= $${params.length}`);
    }
    if (req.query.to && isValidDateString(req.query.to)) {
      params.push(req.query.to);
      where.push(`reading_date <= $${params.length}`);
    }
    const whereSql = where.join(' AND ');
    const total = (await pool.query(`SELECT count(*)::int AS n FROM readings WHERE ${whereSql}`, params)).rows[0].n;
    const { rows } = await pool.query(
      `SELECT * FROM readings WHERE ${whereSql}
       ORDER BY reading_date DESC, CASE slot WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ readings: rows.map(toApi), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  });

  router.post('/', async (req, res) => {
    const { errors, clean } = validateReadingInput(req.body, today());
    if (Object.keys(errors).length) return fail(res, errors);
    const dayErrors = await checkDayRules(req.userId, clean);
    if (dayErrors) return fail(res, dayErrors, 409);
    try {
      const { rows } = await pool.query(
        'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.userId, clean.date, clean.slot, clean.value],
      );
      res.status(201).json({ reading: toApi(rows[0]) });
    } catch (err) {
      // Two requests racing past the check above: the unique constraint still protects us.
      if (err.code === '23505') return fail(res, { slot: `You already have an ${SLOTS[clean.slot]} reading for this date.` }, 409);
      throw err;
    }
  });

  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ error: 'Reading not found.' });
    const existing = await pool.query('SELECT id FROM readings WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Reading not found.' });

    const { errors, clean } = validateReadingInput(req.body, today());
    if (Object.keys(errors).length) return fail(res, errors);
    const dayErrors = await checkDayRules(req.userId, clean, id);
    if (dayErrors) return fail(res, dayErrors, 409);
    try {
      const { rows } = await pool.query(
        'UPDATE readings SET reading_date = $1, slot = $2, value = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
        [clean.date, clean.slot, clean.value, id, req.userId],
      );
      res.json({ reading: toApi(rows[0]) });
    } catch (err) {
      if (err.code === '23505') return fail(res, { slot: `You already have an ${SLOTS[clean.slot]} reading for this date.` }, 409);
      throw err;
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ error: 'Reading not found.' });
    const { rowCount } = await pool.query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (!rowCount) return res.status(404).json({ error: 'Reading not found.' });
    res.status(204).end();
  });

  return router;
};
