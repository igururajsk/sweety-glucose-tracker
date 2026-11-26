const { isValidDateString, pad, lastDayOfMonth } = require('./dates');

const REPORT_TYPES = ['daily', 'mtd', 'monthly'];

/**
 * Date range for a report, relative to the selected date.
 *  daily   -> the selected date
 *  mtd     -> 1st of the selected date's month up to the selected date
 *  monthly -> the whole month before the selected date's month
 */
function reportRange(type, date) {
  if (!REPORT_TYPES.includes(type)) throw new Error(`Unknown report type: ${type}`);
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m] = date.split('-').map(Number);

  if (type === 'daily') return { from: date, to: date };
  if (type === 'mtd') return { from: `${y}-${pad(m)}-01`, to: date };

  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDayOfMonth(py, pm))}` };
}

/** Highest, lowest, average (1 decimal) and count for a list of values. */
function summarize(values) {
  if (values.length === 0) return { count: 0, highest: null, lowest: null, average: null };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    highest: Math.max(...values),
    lowest: Math.min(...values),
    average: Math.round((sum / values.length) * 10) / 10,
  };
}

module.exports = { reportRange, summarize, REPORT_TYPES };
