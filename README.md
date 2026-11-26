# Sweety - blood glucose tracker

A small web app where a person with diabetes records up to 4 blood glucose readings a day and views daily, month-to-date and previous-month reports.

- **Server:** Node.js + Express + PostgreSQL (`server/`)
- **Client:** React + Vite (`client/`)
- **Auth:** email and password (bcrypt hashed), JWT sent as a Bearer token. Each user only sees their own readings.

## Features

Required:
- Sign up and log in; passwords are stored as bcrypt hashes.
- Add, view, edit and delete readings (date, slot, value in mg/dl). Slots: Morning (fasting), After breakfast, After lunch, After dinner.
- Validation with clear messages in the UI (and the same rules enforced by the API): value required, whole number 40-600, one reading per slot per day, max 4 per day, no future dates.
- Reports: daily, month-to-date and previous month, each with highest, lowest, average (1 decimal) and count; a friendly empty state; the daily report lists readings with their slot.

Bonus tasks done: pagination on `GET /readings` (`?page=1&limit=20`), a line chart of the month (Recharts), `docker-compose.yml` for PostgreSQL, React Testing Library tests for the reading form.

## Requirements

- Node.js 20+ and npm
- PostgreSQL 14+ (or Docker, see below)

## Install

```bash
git clone <this repo>
cd <repo>
(cd server && npm install)
(cd client && npm install)
```

## Set up the database

Option A, Docker (easiest):

```bash
docker compose up -d        # PostgreSQL 16 on localhost:5432, user/password/db: sweety
```

Option B, your own PostgreSQL: create a database and use its URL in `server/.env`.

Then configure and create the tables:

```bash
cd server
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET if needed
npm run db:migrate          # creates the tables (safe to run again)
npm run db:seed             # demo user with about 6 weeks of sample readings
```

Demo login after seeding: `demo@sweety.test` / `demo1234`. Running the seed again resets that demo user's data.

## Run

```bash
# terminal 1: API on http://localhost:4000
cd server && npm start

# terminal 2: React app on http://localhost:5173
cd client
cp .env.example .env        # VITE_API_URL, default http://localhost:4000
npm run dev
```

## Run the tests

```bash
cd server && npm test       # unit tests + API tests + seed test
cd client && npm test       # React Testing Library tests for the reading form
```

Server API tests need a PostgreSQL database. If `TEST_DATABASE_URL` is set (see `server/.env.example`) they use it and **truncate its tables**, so point it at a throwaway database. If it is not set, the tests start a temporary embedded PostgreSQL (from the `embedded-postgres` dev dependency), so no setup is needed.

## API

All routes except `/auth/*` need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/signup` | `{ name, email, password }` returns `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` returns `{ token, user }` |
| GET | `/auth/me` | current user |
| GET | `/readings?page=1&limit=20` | own readings, newest first, with `total` and `totalPages` |
| POST | `/readings` | `{ date: "YYYY-MM-DD", slot, value }` |
| PUT | `/readings/:id` | same body, edits own reading |
| DELETE | `/readings/:id` | deletes own reading |
| GET | `/reports?type=daily\|mtd\|monthly&date=YYYY-MM-DD` | report for the selected date (default today) |

Slot keys: `morning`, `after_breakfast`, `after_lunch`, `after_dinner`.

Report ranges for a selected date of 15 Oct 2026: daily is 15 Oct, `mtd` is 1 Oct to 15 Oct, `monthly` is the whole of September.

## Project layout

```
server/
  db/schema.sql           tables and constraints
  src/lib/                validation, date and report helpers (pure functions)
  src/routes/             auth, readings, reports
  src/seed.js             demo data
  test/                   node:test + supertest
client/
  src/components/         AuthForm, ReadingForm, ReadingsList, Reports
  src/ReadingForm.test.jsx
docker-compose.yml        PostgreSQL for local development
```

## Notes

Assumptions:
- "Today" is decided in the `APP_TIMEZONE` time zone (default `Asia/Kolkata`) on the server. The browser uses its own local date for the date picker and for the instant "no future dates" message.
- A reading is one value per user, date and slot. This is enforced both in code and by a unique constraint in the database, so two simultaneous requests cannot create a duplicate.
- Because there are only 4 slots, a 5th reading on a day is always a duplicate slot, so people normally see the "You already have an ... reading" message. The "only 4 readings per day" check is still in the API as a safety net (it runs after the slot check).
- The "monthly" report always means the whole month before the selected date's month, as in the brief.
- Report averages are rounded to 1 decimal.
- Users can pick any past date, including dates before they signed up (useful for back-filling readings).
- The chart shows readings from the selected month up to the selected date, using the 100 most recent readings.
- I used `bcryptjs` (pure JavaScript) instead of native `bcrypt` so installation does not need a compiler.
- The JWT is kept in `localStorage` for simplicity.

What I would improve with more time:
- Rate limiting on login, email verification and password reset.
- Store the token in an httpOnly cookie.
- A proper migration tool instead of one idempotent `schema.sql`.
- Per-patient time zones; server-side report caching (for example Redis) if data grows.
- Browser end-to-end tests, and frontend tests for the reports and list components (only the reading form is covered now).
- A date range filter and CSV export for sharing with a doctor.

## AI assistance

This project was built with help from an AI coding assistant working on behalf of the author. The code, tests and README were generated with that assistance, then run and checked (server tests, client tests, and a manual walkthrough of the app). The author is responsible for the submission and should be asked about any part of it.
