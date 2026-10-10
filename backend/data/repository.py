"""Shared database functions. Caller IDs must come from verified authentication."""
from datetime import datetime, timezone
from uuid import UUID

from psycopg import errors, sql

from .db import connect


class DataError(ValueError):
    """Expected failure: APIs branch on code, never the human-readable message."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


# Split so other queries can prepend their own columns without string surgery.
EVENT_COLUMNS = """
    e.*, u.name AS organizer_name,
        (SELECT COUNT(*) FROM public.registrations r
         WHERE r.event_id = e.event_id
           AND r.registration_status = 'Registered') AS registration_count
"""
EVENT_FROM = """
    FROM public.events e
    JOIN public.users u ON u.user_id = e.organizer_id
"""
EVENT_SELECT = "SELECT" + EVENT_COLUMNS + EVENT_FROM
REQUIRED = {"title", "description", "location", "start_datetime", "end_datetime"}
EDITABLE = REQUIRED | {"image", "category", "capacity", "status"}
STATUSES = {"Draft", "Published", "Cancelled", "Completed"}


def _id(value):
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise DataError("INVALID_INPUT", "Expected a UUID.") from None


def _date(value, field):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise DataError("INVALID_INPUT", f"{field} must be an ISO 8601 datetime.") from None
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise DataError("INVALID_INPUT", f"{field} must include a timezone.")
    return value.astimezone(timezone.utc)


def _text(value, field, required=True):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value.strip():
        raise DataError("INVALID_INPUT", f"{field} must be nonempty text.")
    return value.strip()

def _fields(fields, current=None):
    if not fields or fields.keys() - EDITABLE:
        raise DataError("INVALID_INPUT", "Provide supported event fields only.")
    if current is None and REQUIRED - fields.keys():
        raise DataError("INVALID_INPUT", "Missing required event fields.")
    fields = dict(fields)
    for name in ("title", "description", "location"):
        if name in fields:
            fields[name] = _text(fields[name], name)
    for name in ("image", "category"):
        if name in fields and fields[name] is not None and not isinstance(fields[name], str):
            raise DataError("INVALID_INPUT", f"{name} must be text or null.")
    if "capacity" in fields:
        cap = fields["capacity"]
        if cap is not None and (type(cap) is not int or not 0 < cap <= 2147483647):
            raise DataError("INVALID_INPUT", "capacity must be a positive integer or null.")
    if "status" in fields and (not isinstance(fields["status"], str) or fields["status"] not in STATUSES):
        raise DataError("INVALID_INPUT", "Unsupported event status.")
    for name in ("start_datetime", "end_datetime"):
        if name in fields:
            fields[name] = _date(fields[name], name)
    combined = {**(current or {}), **fields}
    if combined["end_datetime"] <= combined["start_datetime"]:
        raise DataError("INVALID_INPUT", "end_datetime must be after start_datetime.")
    if "start_datetime" in fields and fields["start_datetime"] <= datetime.now(timezone.utc):
        raise DataError("INVALID_INPUT", "A new start_datetime must be in the future.")
    return fields


def _user(conn, user_id):
    if conn.execute("SELECT 1 FROM public.users WHERE user_id = %s", (user_id,)).fetchone() is None:
        raise DataError("USER_NOT_FOUND", "User not found.")


def _lock(conn, event_id, organizer_id=None):
    event = conn.execute("SELECT * FROM public.events WHERE event_id = %s FOR UPDATE", (event_id,)).fetchone()
    if event is None:
        raise DataError("EVENT_NOT_FOUND", "Event not found.")
    if organizer_id is not None and event["organizer_id"] != organizer_id:
        raise DataError("FORBIDDEN", "Only this event's organizer can manage it.")
    return event


def _future(conn, event):
    # Use database time after acquiring the lock, including time spent waiting.
    future = conn.execute("SELECT %s::timestamptz > clock_timestamp() AS future", (event["start_datetime"],)).fetchone()["future"]
    if not future:
        raise DataError("EVENT_ALREADY_STARTED", "This event has already started.")


def _count(conn, event_id):
    return conn.execute("""SELECT COUNT(*) AS total FROM public.registrations
        WHERE event_id = %s AND registration_status = 'Registered'""", (event_id,)).fetchone()["total"]


def _event(row):
    row["remaining_capacity"] = None if row["capacity"] is None else row["capacity"] - row["registration_count"]
    return row


def _read_event(conn, event_id):
    return _event(conn.execute(EVENT_SELECT + " WHERE e.event_id = %s", (event_id,)).fetchone())


def create_user(name, email, profile_image=None):
    """Create a profile for the authentication integration. Email is unique, case-insensitive."""
    name = _text(name, "name")
    email = _text(email, "email")
    if email.count("@") != 1 or email.startswith("@") or email.endswith("@"):
        raise DataError("INVALID_INPUT", "email must contain a single @ with text on both sides.")
    profile_image = _text(profile_image, "profile_image", required=False)
    try:
        with connect() as conn:
            return conn.execute(
                """INSERT INTO public.users (name, email, profile_image)
                VALUES (%s, %s, %s) RETURNING *""",
                (name, email, profile_image),
            ).fetchone()
    except errors.UniqueViolation:
        raise DataError("EMAIL_TAKEN", "An account already uses this email.") from None


def get_user(user_id):
    """Look up one profile by ID."""
    user_id = _id(user_id)
    with connect() as conn:
        row = conn.execute("SELECT * FROM public.users WHERE user_id = %s", (user_id,)).fetchone()
    if row is None:
        raise DataError("USER_NOT_FOUND", "User not found.")
    return row


def find_user_by_email(email):
    """Return the matching profile, or None. Case-insensitive; never raises for a miss."""
    email = _text(email, "email")
    with connect() as conn:
        return conn.execute(
            "SELECT * FROM public.users WHERE lower(email) = lower(%s)", (email,)
        ).fetchone()


def get_or_create_user(email, name, profile_image=None):
    """Resolve a verified identity to a profile, creating it on first sign-in."""
    existing = find_user_by_email(email)
    if existing is not None:
        return existing
    try:
        return create_user(name, email, profile_image)
    except DataError as error:
        # Another request created the same profile between the lookup and insert.
        if error.code != "EMAIL_TAKEN":
            raise
        concurrent = find_user_by_email(email)
        if concurrent is None:
            raise
        return concurrent


def list_events():
    """Upcoming published events, in start-time order."""
    return search_events()


def search_events(query=None, category=None, date_from=None, date_to=None):
    """Case-insensitive literal substring search; date range is [from, to)."""
    clauses = ["e.status = 'Published'", "e.start_datetime > CURRENT_TIMESTAMP"]
    params = []
    if query is not None:
        if not isinstance(query, str):
            raise DataError("INVALID_INPUT", "query must be text.")
        clauses.append("(strpos(lower(e.title), lower(%s)) > 0 OR strpos(lower(e.description), lower(%s)) > 0 OR strpos(lower(e.location), lower(%s)) > 0)")
        params.extend([query] * 3)
    if category is not None:
        if not isinstance(category, str):
            raise DataError("INVALID_INPUT", "category must be text.")
        clauses.append("e.category = %s")
        params.append(category)
    lower = _date(date_from, "date_from") if date_from is not None else None
    upper = _date(date_to, "date_to") if date_to is not None else None
    if lower is not None and upper is not None and lower >= upper:
        raise DataError("INVALID_INPUT", "date_from must be before date_to.")
    for value, clause in ((lower, "e.start_datetime >= %s"), (upper, "e.start_datetime < %s")):
        if value is not None:
            clauses.append(clause)
            params.append(value)
    with connect() as conn:
        rows = conn.execute(EVENT_SELECT + " WHERE " + " AND ".join(clauses) + " ORDER BY e.start_datetime, e.event_id", params).fetchall()
    return [_event(row) for row in rows]


def get_event(event_id):
    """Public detail lookup: only Published events, including past ones."""
    event_id = _id(event_id)
    with connect() as conn:
        row = conn.execute(EVENT_SELECT + " WHERE e.event_id = %s", (event_id,)).fetchone()
    if row is None:
        raise DataError("EVENT_NOT_FOUND", "Event not found.")
    if row["status"] != "Published":
        raise DataError("EVENT_NOT_PUBLISHED", "This event is not published.")
    return _event(row)


def get_organizer_event(event_id, organizer_id):
    """Owner-only lookup in any status, for edit forms that must load a Draft."""
    event_id, organizer_id = _id(event_id), _id(organizer_id)
    with connect() as conn:
        row = conn.execute(EVENT_SELECT + " WHERE e.event_id = %s", (event_id,)).fetchone()
    if row is None:
        raise DataError("EVENT_NOT_FOUND", "Event not found.")
    if row["organizer_id"] != organizer_id:
        raise DataError("FORBIDDEN", "Only this event's organizer can manage it.")
    return _event(row)


def create_event(organizer_id, **fields):
    """Required fields: title, description, location, start_datetime, end_datetime."""
    organizer_id = _id(organizer_id)
    values = {"organizer_id": organizer_id, **_fields(fields)}
    statement = sql.SQL("INSERT INTO public.events ({}) VALUES ({}) RETURNING event_id").format(
        sql.SQL(", ").join(sql.Identifier(key) for key in values),
        sql.SQL(", ").join(sql.Placeholder() for _ in values),
    )
    with connect() as conn:
        _user(conn, organizer_id)
        event_id = conn.execute(statement, list(values.values())).fetchone()["event_id"]
        row = _read_event(conn, event_id)
    return row


def update_event(event_id, organizer_id, **fields):
    """Partial update by the owner; capacity cannot fall below active registrations."""
    event_id, organizer_id = _id(event_id), _id(organizer_id)
    with connect() as conn:
        current = _lock(conn, event_id, organizer_id)
        fields = _fields(fields, current)
        if fields.get("capacity") is not None and fields["capacity"] < _count(conn, event_id):
            raise DataError("CAPACITY_TOO_SMALL", "Capacity cannot be below active registrations.")
        statement = sql.SQL("UPDATE public.events SET {} WHERE event_id = %s").format(
            sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(key)) for key in fields)
        )
        conn.execute(statement, [*fields.values(), event_id])
        # Cancelling an event cancels its registrations, so attendee and
        # organizer lists stop reporting people as attending a dead event.
        if fields.get("status") == "Cancelled" and current["status"] != "Cancelled":
            conn.execute("""UPDATE public.registrations SET registration_status = 'Cancelled'
                WHERE event_id = %s AND registration_status = 'Registered'""", (event_id,))
        row = _read_event(conn, event_id)
    return row


def delete_event(event_id, organizer_id):
    """Owner-only permanent deletion, cascading to this event's registrations."""
    event_id, organizer_id = _id(event_id), _id(organizer_id)
    with connect() as conn:
        _lock(conn, event_id, organizer_id)
        conn.execute("DELETE FROM public.events WHERE event_id = %s", (event_id,))
    return True


def list_organizer_events(organizer_id):
    """Owner's events in all statuses, including past events."""
    organizer_id = _id(organizer_id)
    with connect() as conn:
        _user(conn, organizer_id)
        rows = conn.execute(EVENT_SELECT + " WHERE e.organizer_id = %s ORDER BY e.start_datetime, e.event_id", (organizer_id,)).fetchall()
    return [_event(row) for row in rows]


def register_user(event_id, user_id):
    event_id, user_id = _id(event_id), _id(user_id)
    with connect() as conn:
        event = _lock(conn, event_id)
        if event["status"] != "Published":
            raise DataError("EVENT_NOT_PUBLISHED", "This event is not published.")
        _future(conn, event)
        _user(conn, user_id)
        existing = conn.execute("SELECT registration_status FROM public.registrations WHERE event_id = %s AND user_id = %s", (event_id, user_id)).fetchone()
        if existing and existing["registration_status"] == "Registered":
            raise DataError("ALREADY_REGISTERED", "User is already registered for this event.")
        if event["capacity"] is not None and _count(conn, event_id) >= event["capacity"]:
            raise DataError("EVENT_FULL", "This event is full.")
        row = conn.execute("""INSERT INTO public.registrations (event_id, user_id)
            VALUES (%s, %s) ON CONFLICT (event_id, user_id) DO UPDATE
            SET registration_status = 'Registered', registered_at = clock_timestamp()
            RETURNING *""", (event_id, user_id)).fetchone()
    return row


def cancel_registration(event_id, user_id):
    """Cancel only the verified caller's registration before the event starts."""
    event_id, user_id = _id(event_id), _id(user_id)
    with connect() as conn:
        event = _lock(conn, event_id)
        _future(conn, event)
        _user(conn, user_id)
        row = conn.execute("""UPDATE public.registrations SET registration_status = 'Cancelled'
            WHERE event_id = %s AND user_id = %s RETURNING *""", (event_id, user_id)).fetchone()
        if row is None:
            raise DataError("REGISTRATION_NOT_FOUND", "Registration not found.")
    return row


def list_user_registrations(user_id):
    """Active and cancelled registrations, including past events, for one user."""
    user_id = _id(user_id)
    with connect() as conn:
        _user(conn, user_id)
        query = (
            "SELECT mine.registration_id, mine.user_id AS attendee_id,"
            " mine.registration_status, mine.registered_at,"
            + EVENT_COLUMNS
            + EVENT_FROM
            + """ JOIN public.registrations mine ON mine.event_id = e.event_id
            WHERE mine.user_id = %s ORDER BY e.start_datetime, mine.registration_id"""
        )
        results = conn.execute(query, (user_id,)).fetchall()
    rows = []
    for event in results:
        registration = {
            "registration_id": event.pop("registration_id"),
            "user_id": event.pop("attendee_id"),
            "event_id": event["event_id"],
            "registration_status": event.pop("registration_status"),
            "registered_at": event.pop("registered_at"),
        }
        registration["event"] = _event(event)
        rows.append(registration)
    return rows


def list_attendees(event_id, organizer_id):
    """Owner-only active attendee list; contains private names and emails."""
    event_id, organizer_id = _id(event_id), _id(organizer_id)
    with connect() as conn:
        _lock(conn, event_id, organizer_id)
        rows = conn.execute("""SELECT r.*, u.name, u.email FROM public.registrations r
            JOIN public.users u ON u.user_id = r.user_id
            WHERE r.event_id = %s AND r.registration_status = 'Registered'
            ORDER BY r.registered_at, r.registration_id""", (event_id,)).fetchall()
    return rows
