const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReadingInput, validateSignup } = require('../src/lib/validation');
const { reportRange, summarize } = require('../src/lib/reports');
const { isValidDateString, todayIn } = require('../src/lib/dates');

const today = '2026-10-15';

test('validateReadingInput accepts a good reading', () => {
  const { errors, clean } = validateReadingInput({ date: '2026-10-15', slot: 'morning', value: '95' }, today);
  assert.deepEqual(errors, {});
  assert.deepEqual(clean, { date: '2026-10-15', slot: 'morning', value: 95 });
});

test('validateReadingInput: missing value', () => {
  for (const value of [undefined, null, '', '  ']) {
    const { errors } = validateReadingInput({ date: today, slot: 'morning', value }, today);
    assert.equal(errors.value, 'Please enter a glucose value.');
  }
});

test('validateReadingInput: value must be a whole number from 40 to 600', () => {
  const msg = 'Value must be between 40 and 600 mg/dl.';
  for (const value of [39, 601, 99.5, 'abc', '12x', -5, 0]) {
    assert.equal(validateReadingInput({ date: today, slot: 'morning', value }, today).errors.value, msg, String(value));
  }
  for (const value of [40, 600, '120']) {
    assert.equal(validateReadingInput({ date: today, slot: 'morning', value }, today).errors.value, undefined, String(value));
  }
});

test('validateReadingInput: future dates are rejected, today is fine', () => {
  assert.equal(validateReadingInput({ date: '2026-10-16', slot: 'morning', value: 100 }, today).errors.date, 'Date cannot be in the future.');
  assert.equal(validateReadingInput({ date: '2026-10-15', slot: 'morning', value: 100 }, today).errors.date, undefined);
});

test('validateReadingInput: bad dates and slots', () => {
  assert.ok(validateReadingInput({ date: '2026-02-30', slot: 'morning', value: 100 }, today).errors.date);
  assert.ok(validateReadingInput({ date: 'nope', slot: 'morning', value: 100 }, today).errors.date);
  assert.ok(validateReadingInput({ date: today, slot: 'midnight', value: 100 }, today).errors.slot);
});

test('validateSignup', () => {
  assert.deepEqual(validateSignup({ name: 'A', email: 'a@b.co', password: 'longenough' }), {});
  const errors = validateSignup({ name: '', email: 'bad', password: 'short' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'name', 'password']);
});

test('reportRange matches the examples in the brief (selected date 15 Oct 2026)', () => {
  assert.deepEqual(reportRange('daily', '2026-10-15'), { from: '2026-10-15', to: '2026-10-15' });
  assert.deepEqual(reportRange('mtd', '2026-10-15'), { from: '2026-10-01', to: '2026-10-15' });
  assert.deepEqual(reportRange('monthly', '2026-10-15'), { from: '2026-09-01', to: '2026-09-30' });
});

test('reportRange monthly handles January and leap-year February', () => {
  assert.deepEqual(reportRange('monthly', '2027-01-10'), { from: '2026-12-01', to: '2026-12-31' });
  assert.deepEqual(reportRange('monthly', '2028-03-05'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(reportRange('monthly', '2027-03-05'), { from: '2027-02-01', to: '2027-02-28' });
});

test('summarize rounds the average to 1 decimal and handles empty input', () => {
  assert.deepEqual(summarize([100, 101, 103]), { count: 3, highest: 103, lowest: 100, average: 101.3 });
  assert.deepEqual(summarize([90]), { count: 1, highest: 90, lowest: 90, average: 90 });
  assert.deepEqual(summarize([]), { count: 0, highest: null, lowest: null, average: null });
});

test('date helpers', () => {
  assert.equal(isValidDateString('2028-02-29'), true);
  assert.equal(isValidDateString('2027-02-29'), false);
  // 20:00 UTC on 14 Oct is already 15 Oct in India.
  assert.equal(todayIn('Asia/Kolkata', new Date('2026-10-14T20:00:00Z')), '2026-10-15');
  assert.equal(todayIn('UTC', new Date('2026-10-14T20:00:00Z')), '2026-10-14');
});
