from pathlib import Path
import os

import psycopg
from dotenv import load_dotenv

# Load connection settings from backend/.env.
load_dotenv(Path(__file__).with_name(".env"))

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise SystemExit("DATABASE_URL is missing from backend/.env.")

# Connect securely and check the sample data.
with psycopg.connect(
    database_url, sslmode="require", connect_timeout=10
) as connection:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                (SELECT COUNT(*) FROM public.users),
                (SELECT COUNT(*) FROM public.events),
                (SELECT COUNT(*) FROM public.registrations)
        """)
        users, events, registrations = cursor.fetchone()

        print("Connected to Supabase!")
        print(f"Users: {users}")
        print(f"Events: {events}")
        print(f"Registrations: {registrations}")