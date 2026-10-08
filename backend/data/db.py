import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

# Load the connection settings from backend/.env.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def connect():
    """Open a database connection with results returned as dictionaries."""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("Set DATABASE_URL in backend/.env first.")

    return psycopg.connect(
        database_url,
        sslmode="require",
        connect_timeout=10,
        row_factory=dict_row,
    )