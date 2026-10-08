from datetime import datetime, timezone

from .db import connect


def list_events():
    """Return upcoming published events with organizer and capacity details."""
    query = """
        SELECT
            e.*,
            u.name AS organizer_name,
            (
                SELECT COUNT(*)
                FROM public.registrations r
                WHERE r.event_id = e.event_id
                  AND r.registration_status = 'Registered'
            ) AS registration_count
        FROM public.events e
        JOIN public.users u ON u.user_id = e.organizer_id
        WHERE e.status = 'Published'
          AND e.start_datetime > CURRENT_TIMESTAMP
        ORDER BY e.start_datetime, e.event_id
    """

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            events = cursor.fetchall()

    # A missing capacity means the event allows unlimited registrations.
    for event in events:
        if event["capacity"] is None:
            event["remaining_capacity"] = None
        else:
            event["remaining_capacity"] = (
                event["capacity"] - event["registration_count"]
            )

    return events


def register_user(event_id, user_id):
    """Register a user while checking event availability and capacity."""
    with connect() as connection:
        with connection.cursor() as cursor:
            # Lock this event until the transaction finishes.
            cursor.execute(
                """
                SELECT *
                FROM public.events
                WHERE event_id = %s
                FOR UPDATE
                """,
                (event_id,),
            )
            event = cursor.fetchone()

            if event is None:
                raise ValueError("Event not found.")

            if event["status"] != "Published":
                raise ValueError("This event is not open for registration.")

            if event["start_datetime"] <= datetime.now(timezone.utc):
                raise ValueError("This event has already started.")

            cursor.execute(
                "SELECT user_id FROM public.users WHERE user_id = %s",
                (user_id,),
            )
            if cursor.fetchone() is None:
                raise ValueError("User not found.")

            # Check whether this user is already registered.
            cursor.execute(
                """
                SELECT registration_status
                FROM public.registrations
                WHERE event_id = %s AND user_id = %s
                """,
                (event_id, user_id),
            )
            existing = cursor.fetchone()

            if existing and existing["registration_status"] == "Registered":
                raise ValueError("User is already registered for this event.")

            cursor.execute(
                """
                SELECT COUNT(*) AS total
                FROM public.registrations
                WHERE event_id = %s
                  AND registration_status = 'Registered'
                """,
                (event_id,),
            )
            total = cursor.fetchone()["total"]

            if event["capacity"] is not None and total >= event["capacity"]:
                raise ValueError("This event is full.")

            # Reuse a cancelled registration if one already exists.
            cursor.execute(
                """
                INSERT INTO public.registrations (event_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT (event_id, user_id)
                DO UPDATE SET
                    registration_status = 'Registered',
                    registered_at = NOW()
                RETURNING *
                """,
                (event_id, user_id),
            )
            registration = cursor.fetchone()

    return registration