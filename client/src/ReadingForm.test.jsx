import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReadingForm from './components/ReadingForm.jsx';
import { ApiError } from './api.js';

async function fill(value) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(/glucose/i);
  if (value !== undefined) await user.type(input, value);
  await user.click(screen.getByRole('button', { name: /add reading/i }));
  return user;
}

test('shows an error and does not submit when the value is empty', async () => {
  const onSubmit = vi.fn();
  render(<ReadingForm onSubmit={onSubmit} />);
  await fill();
  expect(screen.getByRole('alert')).toHaveTextContent('Please enter a glucose value.');
  expect(onSubmit).not.toHaveBeenCalled();
});

test.each(['39', '601', '99.5', 'abc'])('rejects %s as out of range', async (v) => {
  const onSubmit = vi.fn();
  render(<ReadingForm onSubmit={onSubmit} />);
  await fill(v);
  expect(screen.getByRole('alert')).toHaveTextContent('Value must be between 40 and 600 mg/dl.');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('rejects a future date', async () => {
  const onSubmit = vi.fn();
  render(<ReadingForm onSubmit={onSubmit} />);
  const user = userEvent.setup();
  const date = screen.getByLabelText(/date/i);
  const next = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await user.clear(date);
  await user.type(date, next);
  await user.type(screen.getByLabelText(/glucose/i), '100');
  await user.click(screen.getByRole('button', { name: /add reading/i }));
  expect(screen.getByRole('alert')).toHaveTextContent('Date cannot be in the future.');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('submits a valid reading as a number and clears the value', async () => {
  const onSubmit = vi.fn().mockResolvedValue();
  render(<ReadingForm onSubmit={onSubmit} />);
  const user = await fill('120');
  await user.selectOptions(screen.getByLabelText(/time slot/i), 'after_lunch');
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ value: 120, slot: 'morning' });
  expect(screen.getByLabelText(/glucose/i)).toHaveValue('');
});

test('shows the server message, such as a duplicate slot', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new ApiError('You already have an After lunch reading for this date.', 409));
  render(<ReadingForm onSubmit={onSubmit} />);
  await fill('120');
  expect(await screen.findByRole('alert')).toHaveTextContent('You already have an After lunch reading for this date.');
});
