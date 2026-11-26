const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { startDb, buildApp, resetTables } = require('./helpers');
const { todayIn } = require('../src/lib/dates');

let db;
let app;
const today = todayIn('Asia/Kolkata');
const daysAgo = (n) => {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

async function signup(email = 'a@example.com', name = 'Ann') {
  const res = await request(app).post('/auth/signup').send({ name, email, password: 'password1' });
  assert.equal(res.status, 201);
  return res.body.token;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

test.before(async () => {
  db = await startDb();
  app = buildApp(db.pool);
});
test.after(async () => db.stop());
test.beforeEach(async () => resetTables(db.pool));

test('signup stores a bcrypt hash, never the plain password', async () => {
  await signup();
  const { rows } = await db.pool.query('SELECT password_hash FROM users');
  assert.notEqual(rows[0].password_hash, 'password1');
  assert.ok(rows[0].password_hash.startsWith('$2'));
  assert.equal(await bcrypt.compare('password1', rows[0].password_hash), true);
});

test('signup rejects duplicate email; login works and rejects wrong password', async () => {
  await signup('dup@example.com');
  const dup = await request(app).post('/auth/signup').send({ name: 'X', email: 'DUP@example.com', password: 'password1' });
  assert.equal(dup.status, 409);
  const ok = await request(app).post('/auth/login').send({ email: 'dup@example.com', password: 'password1' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const bad = await request(app).post('/auth/login').send({ email: 'dup@example.com', password: 'wrong' });
  assert.equal(bad.status, 401);
});

test('readings routes need a token', async () => {
  assert.equal((await request(app).get('/readings')).status, 401);
  assert.equal((await request(app).get('/reports')).status, 401);
});

test('create, list, edit and delete a reading', async () => {
  const token = await signup();
  const created = await request(app).post('/readings').set(auth(token)).send({ date: today, slot: 'morning', value: 98 });
  assert.equal(created.status, 201);
  assert.equal(created.body.reading.slotLabel, 'Morning (fasting)');
  const id = created.body.reading.id;

  const list = await request(app).get('/readings').set(auth(token));
  assert.equal(list.body.total, 1);

  const edited = await request(app).put(`/readings/${id}`).set(auth(token)).send({ date: today, slot: 'morning', value: 110 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.reading.value, 110);

  assert.equal((await request(app).delete(`/readings/${id}`).set(auth(token))).status, 204);
  assert.equal((await request(app).get('/readings').set(auth(token))).body.total, 0);
});

test('validation messages from the brief', async () => {
  const token = await signup();
  const post = (body) => request(app).post('/readings').set(auth(token)).send(body);

  let res = await post({ date: today, slot: 'morning' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Please enter a glucose value.');

  res = await post({ date: today, slot: 'morning', value: 700 });
  assert.equal(res.body.error, 'Value must be between 40 and 600 mg/dl.');

  res = await post({ date: daysAgo(-1), slot: 'morning', value: 100 });
  assert.equal(res.body.error, 'Date cannot be in the future.');
});

test('only one reading per slot per day', async () => {
  const token = await signup();
  const body = { date: today, slot: 'after_lunch', value: 140 };
  assert.equal((await request(app).post('/readings').set(auth(token)).send(body)).status, 201);
  const dup = await request(app).post('/readings').set(auth(token)).send({ ...body, value: 150 });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'You already have an After lunch reading for this date.');
});

test('a full day (4 readings) accepts no more, and an edit cannot move into it', async () => {
  const token = await signup();
  for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
    assert.equal((await request(app).post('/readings').set(auth(token)).send({ date: today, slot, value: 100 })).status, 201);
  }
  const extra = await request(app).post('/readings').set(auth(token)).send({ date: today, slot: 'morning', value: 100 });
  assert.equal(extra.status, 409);

  const other = await request(app).post('/readings').set(auth(token)).send({ date: daysAgo(1), slot: 'morning', value: 100 });
  const moved = await request(app).put(`/readings/${other.body.reading.id}`).set(auth(token)).send({ date: today, slot: 'morning', value: 100 });
  assert.equal(moved.status, 409);
});

test('editing a reading to its own slot and date is not a duplicate', async () => {
  const token = await signup();
  const r = await request(app).post('/readings').set(auth(token)).send({ date: today, slot: 'morning', value: 90 });
  const res = await request(app).put(`/readings/${r.body.reading.id}`).set(auth(token)).send({ date: today, slot: 'morning', value: 91 });
  assert.equal(res.status, 200);
});

test('users only see and change their own readings', async () => {
  const a = await signup('a@example.com');
  const b = await signup('b@example.com', 'Bob');
  const r = await request(app).post('/readings').set(auth(a)).send({ date: today, slot: 'morning', value: 100 });
  assert.equal((await request(app).get('/readings').set(auth(b))).body.total, 0);
  assert.equal((await request(app).put(`/readings/${r.body.reading.id}`).set(auth(b)).send({ date: today, slot: 'morning', value: 120 })).status, 404);
  assert.equal((await request(app).delete(`/readings/${r.body.reading.id}`).set(auth(b))).status, 404);
  const rep = await request(app).get(`/reports?type=daily&date=${today}`).set(auth(b));
  assert.equal(rep.body.empty, true);
});

test('pagination', async () => {
  const token = await signup();
  for (let i = 0; i < 5; i++) {
    await request(app).post('/readings').set(auth(token)).send({ date: daysAgo(i), slot: 'morning', value: 100 + i });
  }
  const page2 = await request(app).get('/readings?page=2&limit=2').set(auth(token));
  assert.equal(page2.body.readings.length, 2);
  assert.equal(page2.body.total, 5);
  assert.equal(page2.body.totalPages, 3);
  assert.equal(page2.body.readings[0].date, daysAgo(2));
});

test('reports: daily, month-to-date and previous month', async () => {
  const token = await signup();
  const add = (date, slot, value) => request(app).post('/readings').set(auth(token)).send({ date, slot, value });
  // Selected date 2026-10-15 (as in the brief). Use only past dates relative to "today" (>= Nov 2026).
  await add('2026-10-15', 'morning', 100);
  await add('2026-10-15', 'after_lunch', 141);
  await add('2026-10-01', 'morning', 90);
  await add('2026-10-16', 'morning', 300); // after the selected date: not in MTD
  await add('2026-09-30', 'morning', 80);
  await add('2026-09-01', 'after_dinner', 121);
  await add('2026-08-31', 'morning', 500); // not in September

  const daily = (await request(app).get('/reports?type=daily&date=2026-10-15').set(auth(token))).body;
  assert.equal(daily.count, 2);
  assert.equal(daily.highest, 141);
  assert.equal(daily.lowest, 100);
  assert.equal(daily.average, 120.5);
  assert.deepEqual(daily.readings.map((r) => r.slotLabel), ['Morning (fasting)', 'After lunch']);

  const mtd = (await request(app).get('/reports?type=mtd&date=2026-10-15').set(auth(token))).body;
  assert.deepEqual(mtd.range, { from: '2026-10-01', to: '2026-10-15' });
  assert.equal(mtd.count, 3);
  assert.equal(mtd.average, 110.3);

  const monthly = (await request(app).get('/reports?type=monthly&date=2026-10-15').set(auth(token))).body;
  assert.deepEqual(monthly.range, { from: '2026-09-01', to: '2026-09-30' });
  assert.equal(monthly.count, 2);
  assert.equal(monthly.highest, 121);
  assert.equal(monthly.lowest, 80);
  assert.equal(monthly.average, 100.5);
});

test('reports: empty state and bad input', async () => {
  const token = await signup();
  const empty = (await request(app).get('/reports?type=monthly&date=2026-10-15').set(auth(token))).body;
  assert.equal(empty.empty, true);
  assert.equal(empty.count, 0);
  assert.equal(empty.average, null);
  assert.equal((await request(app).get('/reports?type=weekly').set(auth(token))).status, 400);
  assert.equal((await request(app).get('/reports?date=2026-13-01').set(auth(token))).status, 400);
});
