from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from data.db import connect
from data.repository import DataError, register_user

event_id = uuid4()
organizer_id = "10000000-0000-4000-8000-000000000001"
attendee_ids = [
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
]

# Have both workers begin their registration attempts together.
start = Barrier(2)


def try_registration(user_id):
    start.wait(timeout=15)

    try:
        register_user(event_id, user_id)
        return "registered"
    except DataError as error:
        if error.code == "EVENT_FULL":
            return "full"
        raise


try:
    # Create a separate event with exactly one spot.
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO public.events (
                event_id, organizer_id, title, description,
                location, start_datetime, end_datetime, capacity, status
            )
            VALUES (
                %s, %s, 'Capacity Test', 'Temporary test event',
                'Test Room', NOW() + INTERVAL '1 day',
                NOW() + INTERVAL '1 day 1 hour', 1, 'Published'
            )
            """,
            (event_id, organizer_id),
        )

    # Attempt both registrations using separate database connections.
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(try_registration, attendee_ids))

    if sorted(results) != ["full", "registered"]:
        raise AssertionError(f"Unexpected results: {results}")

    # Confirm that only one active registration was saved.
    with connect() as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS total
            FROM public.registrations
            WHERE event_id = %s
              AND registration_status = 'Registered'
            """,
            (event_id,),
        ).fetchone()

    if row["total"] != 1:
        raise AssertionError("Expected exactly one saved registration.")

    print("PASS: One attendee registered.")
    print("PASS: The other attendee was blocked because the event was full.")
    print("PASS: Exactly one registration was saved.")

finally:
    # Delete only this test event and its associated registrations.
    with connect() as connection:
        connection.execute(
            "DELETE FROM public.events WHERE event_id = %s",
            (event_id,),
        )

    print("Temporary test event removed.")
