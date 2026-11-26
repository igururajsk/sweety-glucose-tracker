import { useState } from 'react';
import { SLOTS, todayLocal } from '../slots.js';
import { ApiError } from '../api.js';

/**
 * Add or edit a reading. `onSubmit(values)` should return a promise that
 * rejects with an ApiError when the server refuses the reading.
 */
export default function ReadingForm({ initial, onSubmit, onCancel }) {
  const [date, setDate] = useState(initial?.date || todayLocal());
  const [slot, setSlot] = useState(initial?.slot || SLOTS[0].value);
  const [value, setValue] = useState(initial ? String(initial.value) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    // Same rules as the server, so people get instant feedback.
    if (String(value).trim() === '') return setError('Please enter a glucose value.');
    const n = Number(value);
    if (!Number.isInteger(n) || n < 40 || n > 600) return setError('Value must be between 40 and 600 mg/dl.');
    if (date > todayLocal()) return setError('Date cannot be in the future.');

    setBusy(true);
    try {
      await onSubmit({ date, slot, value: n });
      if (!initial) setValue('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card reading-form" onSubmit={submit} noValidate>
      <h3>{initial ? 'Edit reading' : 'Add a reading'}</h3>
      <div className="row">
        <label>
          Date
          <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Time slot
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>
            {SLOTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          Glucose (mg/dl)
          <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>{initial ? 'Save changes' : 'Add reading'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
