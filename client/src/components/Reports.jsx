import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';
import { todayLocal } from '../slots.js';

const TABS = [
  { type: 'daily', label: 'Daily' },
  { type: 'mtd', label: 'Month to date' },
  { type: 'monthly', label: 'Previous month' },
];

export default function Reports({ refreshKey }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(todayLocal());
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api
      .report(type, date)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [type, date, refreshKey]);

  const rangeText = report && (report.range.from === report.range.to ? report.range.from : `${report.range.from} to ${report.range.to}`);

  return (
    <section className="card">
      <h3>Reports</h3>
      <div className="row">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.type} role="tab" aria-selected={type === t.type} className={type === t.type ? 'tab active' : 'tab'} onClick={() => setType(t.type)}>
              {t.label}
            </button>
          ))}
        </div>
        <label>
          Selected date
          <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {report && (
        <>
          <p className="muted">Showing {rangeText}</p>
          {report.empty ? (
            <p className="empty">Nothing to report for this period yet. Add a reading and it will show up here.</p>
          ) : (
            <>
              <div className="stats">
                <Stat label="Highest" value={report.highest} />
                <Stat label="Lowest" value={report.lowest} />
                <Stat label="Average" value={report.average.toFixed(1)} />
                <Stat label="Readings" value={report.count} unit="" />
              </div>
              {report.readings && (
                <ul className="daily-list">
                  {report.readings.map((r) => (
                    <li key={r.id}><span>{r.slotLabel}</span><strong>{r.value} mg/dl</strong></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
      <MonthChart date={date} refreshKey={refreshKey} />
    </section>
  );
}

function Stat({ label, value, unit = 'mg/dl' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {unit && <div className="stat-unit">{unit}</div>}
    </div>
  );
}

// Line chart of the readings in the selected month (up to the selected date).
function MonthChart({ date, refreshKey }) {
  const [points, setPoints] = useState([]);
  useEffect(() => {
    const month = date.slice(0, 7);
    api
      .listReadings({ page: 1, limit: 100 })
      .then(({ readings }) => {
        const inMonth = readings.filter((r) => r.date.startsWith(month) && r.date <= date);
        setPoints(inMonth.sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ label: `${r.date.slice(8)} ${r.slotLabel.split(' ')[0]}`, value: r.value })));
      })
      .catch(() => setPoints([]));
  }, [date, refreshKey]);
  if (points.length < 2) return null;
  return (
    <div className="chart" data-testid="month-chart">
      <h4>Readings this month</h4>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" hide />
          <YAxis domain={[40, 'auto']} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#c2185b" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
