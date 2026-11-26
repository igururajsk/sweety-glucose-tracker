const { SLOT_KEYS } = require('./slots');
const { isValidDateString } = require('./dates');

const MIN_VALUE = 40;
const MAX_VALUE = 600;

/**
 * Validate the fields of a reading (no database checks).
 * Returns { errors: { field: message }, clean: { date, slot, value } }.
 * `today` is a YYYY-MM-DD string, passed in so this stays easy to test.
 */
function validateReadingInput(body, today) {
  const errors = {};
  const clean = {};
  const { date, slot, value } = body || {};

  if (value === undefined || value === null || String(value).trim() === '') {
    errors.value = 'Please enter a glucose value.';
  } else {
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(n) || n < MIN_VALUE || n > MAX_VALUE) {
      errors.value = `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;
    } else {
      clean.value = n;
    }
  }

  if (!isValidDateString(date)) {
    errors.date = 'Please choose a valid date.';
  } else if (date > today) {
    errors.date = 'Date cannot be in the future.';
  } else {
    clean.date = date;
  }

  if (!SLOT_KEYS.includes(slot)) {
    errors.slot = 'Please choose a time slot.';
  } else {
    clean.slot = slot;
  }

  return { errors, clean };
}

function validateSignup({ name, email, password } = {}) {
  const errors = {};
  if (!name || !String(name).trim()) errors.name = 'Please enter your name.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) errors.email = 'Please enter a valid email address.';
  if (!password || String(password).length < 8) errors.password = 'Password must be at least 8 characters.';
  return errors;
}

module.exports = { validateReadingInput, validateSignup, MIN_VALUE, MAX_VALUE };
