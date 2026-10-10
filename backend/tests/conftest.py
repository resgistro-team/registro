import os
import sys
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from data import repository as repo


@pytest.fixture(scope="session")
def db_connect():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable PostgreSQL database.")

    def connect():
        return psycopg.connect(url, row_factory=dict_row, connect_timeout=10, prepare_threshold=None)

    with connect() as conn:
        conn.execute((BACKEND / "database/schema.sql").read_text())
    return connect


@pytest.fixture
def db(monkeypatch, db_connect):
    monkeypatch.setattr(repo, "connect", db_connect)
    return db_connect


@pytest.fixture
def users(db):
    ids = [uuid4() for _ in range(4)]
    with db() as conn:
        for user_id in ids:
            conn.execute("INSERT INTO public.users (user_id, name, email) VALUES (%s, %s, %s)",
                         (user_id, "Test user", f"{user_id}@example.com"))
    yield ids
    with db() as conn:
        # Scope cleanup to the generated test user IDs and their events.
        conn.execute("DELETE FROM public.events WHERE organizer_id = ANY(%s)", (ids,))
        conn.execute("DELETE FROM public.registrations WHERE user_id = ANY(%s)", (ids,))
        conn.execute("DELETE FROM public.users WHERE user_id = ANY(%s)", (ids,))
