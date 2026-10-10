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
`.env`, keep it; do not overwrite it. Set DATABASE_URL to the Supabase
**Transaction pooler URI** (port 6543) from the project's Connect panel. The
session pooler (5432) holds one server connection per client and runs out under
API traffic. Replace the entire password
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
ownership. Call `get_or_create_user()` once per verified sign-in to provision a
profile; this layer stores no passwords, sessions, or tokens. The seed profiles
are test data, not login accounts. Seed dates are relative to
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

## Connections

`data/db.py` keeps one shared `ConnectionPool` per process, opened on first use.
`connect()` borrows a connection for the duration of a with-block, which commits
on success and rolls back on an exception. Never open raw connections in API
code, and never hold a borrowed connection across a request boundary. Size the
pool with DATABASE_POOL_MIN / DATABASE_POOL_MAX (defaults 1 and 10).

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
