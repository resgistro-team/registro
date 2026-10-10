# Registro backend data layer setup

Requires Python 3.11+ and a PostgreSQL database (the team uses Supabase).
No Flask/FastAPI routes or authentication are implemented in this folder yet.

## Set up a local checkout (Windows PowerShell)

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create `backend/.env` using `.env.example` as the template. If you already have
`.env`, keep it; do not overwrite it. Set DATABASE_URL to the Supabase **Session
pooler URI** from the project's Connect panel. Replace the entire password
placeholder including its brackets. Percent-encode special characters in the
password portion of the URI. Obtain development credentials from your team
privately; do not put them in GitHub, PR comments, or the React application.
`data/db.py` requires SSL. Git ignores `.env` and `.venv`.

## Initialize a database (database owner only)

For an empty development database, run `database/schema.sql` in the Supabase SQL
Editor, then run `database/seed.sql`. Teammates using the already initialized
shared project can skip this step. Both scripts can be rerun without dropping
existing data or duplicating the seed IDs. `IF NOT EXISTS` is a bootstrap guard,
not a migration system: it does not change existing column definitions or repair
drift. Use reviewed migrations for later schema changes; never drop tables just
to rerun setup.

RLS is enabled, with browser-role access revoked. Use the privileged backend
connection, not browser SQL access. The API must enforce authentication and
ownership. Users/profiles must be provisioned by the authentication integration.
The seed profiles are test data, not login accounts. Seed dates are relative to
first insertion; rerunning seed does not refresh existing event dates.

## Verify

```powershell
.\.venv\Scripts\python.exe check_connection.py
.\.venv\Scripts\python.exe show_events.py
.\.venv\Scripts\python.exe check_registrations.py
.\.venv\Scripts\python.exe check_capacity.py
```

The last two checks assume the original demo data is unchanged and its events
have not started. Capacity check creates and deletes only a unique temporary
event. The regression suite below uses isolated records and future dates instead.

## Integration

Run application scripts from `backend` (or add `backend` to PYTHONPATH).
Import functions directly from `data.repository`. See
[`DATA_CONTRACT.md`](../docs/architecture/DATA_CONTRACT.md) for function signatures,
create/update inputs, returned fields, authentication responsibilities, and error
codes. Call `json_ready()` before serializing returned UUID/datetime values.
Catch `DataError` and use `.code`, never match its message text.

## Regression tests

Use a separate disposable PostgreSQL/Supabase development database. These tests
apply schema/seed and create/delete their own records; do not point them at
production. Install test dependencies, set the test connection, then run:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:TEST_DATABASE_URL = 'YOUR_DISPOSABLE_DATABASE_CONNECTION_URI'
.\.venv\Scripts\python.exe -m pytest tests -q
```

Use SSL for remote PostgreSQL, for example `?sslmode=require` in the test URI.
The test connection is separate from DATABASE_URL. Without TEST_DATABASE_URL,
tests are skipped rather than using the shared database by accident. Concurrent
tests require full PostgreSQL; embedded PGlite is useful for sequential checks
but is not evidence of real transaction concurrency.
