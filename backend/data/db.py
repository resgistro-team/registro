"""Process-wide PostgreSQL connection pool.

Use `connect()` as a context manager. The block commits on success and rolls
back on an exception, then returns the connection to the pool.
"""
import atexit
import os
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

# Load the connection settings from backend/.env.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_pool = None
_lock = Lock()


def _build_pool():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("Set DATABASE_URL in backend/.env first.")

    pool = ConnectionPool(
        database_url,
        min_size=int(os.getenv("DATABASE_POOL_MIN", "1")),
        max_size=int(os.getenv("DATABASE_POOL_MAX", "10")),
        timeout=10,
        kwargs={
            "sslmode": os.getenv("DATABASE_SSLMODE", "require"),
            "connect_timeout": 10,
            "row_factory": dict_row,
            # Transaction pooling rejects server-side prepared statements.
            "prepare_threshold": None,
        },
        open=False,
    )
    pool.open()
    atexit.register(pool.close)
    return pool


def pool():
    """Return the shared pool, opening it on first use."""
    global _pool

    if _pool is None:
        with _lock:
            if _pool is None:
                _pool = _build_pool()

    return _pool


def connect():
    """Borrow a pooled connection for the duration of a with-block."""
    return pool().connection()
