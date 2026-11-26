const express = require('express');
const { reportRange, summarize, REPORT_TYPES } = require('../lib/reports');
const { isValidDateString, todayIn } = require('../lib/dates');
const { SLOTS } = require('../lib/slots');

module.exports = function reportRoutes({ pool, config }) {
  const router = express.Router();

  // GET /reports?type=daily|mtd|monthly&date=YYYY-MM-DD   (date defaults to today)
  router.get('/', async (req, res) => {
    const type = req.query.type || 'daily';
    const date = req.query.date || todayIn(config.timezone);
    if (!REPORT_TYPES.includes(type)) return res.status(400).json({ error: 'Report type must be daily, mtd or monthly.' });
    if (!isValidDateString(date)) return res.status(400).json({ error: 'Please choose a valid date.' });

    const range = reportRange(type, date);
    const { rows } = await pool.query(
      `SELECT * FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3
       ORDER BY reading_date, CASE slot WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`,
      [req.userId, range.from, range.to],
    );
    const report = { type, date, range, ...summarize(rows.map((r) => r.value)), empty: rows.length === 0 };
    if (type === 'daily') {
      report.readings = rows.map((r) => ({ id: r.id, date: r.reading_date, slot: r.slot, slotLabel: SLOTS[r.slot], value: r.value }));
    }
    res.json(report);
  });

  return router;
};
