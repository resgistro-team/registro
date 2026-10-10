import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest

from data import repository as r
from data.json_helpers import json_ready


def payload(**changes):
    start = datetime.now(timezone.utc) + timedelta(days=7)
    return dict(title="Python Workshop", description="Learn SQL", location="Room 201",
                start_datetime=start.isoformat(), end_datetime=(start + timedelta(hours=2)).isoformat(),
                **changes)


def expect(code, function, *args, **kwargs):
    with pytest.raises(r.DataError) as caught:
        function(*args, **kwargs)
    assert caught.value.code == code


def test_schema_seed_repeatable(db):
    root = Path(__file__).resolve().parents[1]
    with db() as conn:
        for _ in range(2):
            conn.execute((root / "database/schema.sql").read_text())
            conn.execute((root / "database/seed.sql").read_text())
        assert conn.execute("SELECT COUNT(*) AS n FROM public.users WHERE email = 'organizer@example.com'").fetchone()["n"] == 1
        assert conn.execute("SELECT COUNT(*) AS n FROM public.events WHERE event_id = '20000000-0000-4000-8000-000000000001'").fetchone()["n"] == 1


def test_create_defaults_and_owner_lifecycle(users):
    owner, other, *_ = users
    event = r.create_event(owner, **payload())
    eid = event["event_id"]
    assert event["status"] == "Draft"
    assert event["capacity"] is None and event["remaining_capacity"] is None
    assert event["registration_count"] == 0
    expect("EVENT_NOT_PUBLISHED", r.get_event, eid)
    assert eid not in [x["event_id"] for x in r.list_events()]
    assert [x["event_id"] for x in r.list_organizer_events(owner)] == [eid]
    expect("FORBIDDEN", r.update_event, eid, other, title="Stolen")
    expect("FORBIDDEN", r.delete_event, eid, other)
    event = r.update_event(eid, owner, status="Published", title="Updated")
    assert event["title"] == "Updated" and event["location"] == "Room 201"
    assert r.get_event(eid)["title"] == "Updated"
    json.dumps(json_ready(event))
    assert r.delete_event(eid, owner) is True
    expect("EVENT_NOT_FOUND", r.get_event, eid)
    expect("EVENT_NOT_FOUND", r.delete_event, eid, owner)


@pytest.mark.parametrize("changes", [
    {"title": " "}, {"capacity": 0}, {"capacity": -1}, {"capacity": True},
    {"capacity": "5"}, {"status": "published"}, {"image": 2},
    {"start_datetime": "2027-01-01T12:00:00"}, {"end_datetime": None},
    {"organizer_name": "spoof"}, {"title": None}, {"status": []},
])
def test_invalid_fields(users, changes):
    fields = payload()
    fields.update(changes)
    expect("INVALID_INPUT", r.create_event, users[0], **fields)


def test_missing_fields_ids_dates_and_partial_update(users):
    expect("INVALID_INPUT", r.create_event, users[0], title="Missing fields")
    expect("INVALID_INPUT", r.get_event, "bad-id")
    expect("USER_NOT_FOUND", r.create_event, uuid4(), **payload())
    event = r.create_event(users[0], **payload(status="Published"))
    expect("INVALID_INPUT", r.update_event, event["event_id"], users[0], end_datetime=event["start_datetime"])
    expect("INVALID_INPUT", r.update_event, event["event_id"], users[0])
    assert r.get_event(event["event_id"])["end_datetime"] == event["end_datetime"]
    expect("INVALID_INPUT", r.search_events, date_from="no date")
    expect("INVALID_INPUT", r.search_events, date_from=event["end_datetime"], date_to=event["start_datetime"])


def test_search_visibility_filters_and_literal_query(users, db):
    owner = users[0]
    event = r.create_event(owner, **payload(status="Published", category="Tech"))
    eid = event["event_id"]
    draft = r.create_event(owner, **payload())
    for status in ("Cancelled", "Completed"):
        r.create_event(owner, **payload(status=status))
    assert eid in [x["event_id"] for x in r.search_events("pYtHoN", category="Tech", date_from=event["start_datetime"])]
    assert eid not in [x["event_id"] for x in r.search_events(date_to=event["start_datetime"])]
    assert eid not in [x["event_id"] for x in r.search_events(category="Other")]
    assert draft["event_id"] not in [x["event_id"] for x in r.list_events()]
    assert r.search_events("'; DROP TABLE public.events; --") == []
    assert eid not in [x["event_id"] for x in r.search_events("%")]
    with db() as conn:
        conn.execute("UPDATE public.events SET start_datetime=now()-interval '2 hours', end_datetime=now()-interval '1 hour' WHERE event_id=%s", (eid,))
    assert eid not in [x["event_id"] for x in r.list_events()]
    assert r.get_event(eid)["event_id"] == eid


def test_six_registration_codes(users, db):
    owner, attendee, other, _ = users
    draft = r.create_event(owner, **payload())
    eid = draft["event_id"]
    expect("EVENT_NOT_FOUND", r.register_user, uuid4(), attendee)
    expect("EVENT_NOT_PUBLISHED", r.register_user, eid, attendee)
    r.update_event(eid, owner, status="Published", capacity=1)
    expect("USER_NOT_FOUND", r.register_user, eid, uuid4())
    r.register_user(eid, attendee)
    expect("ALREADY_REGISTERED", r.register_user, eid, attendee)
    expect("EVENT_FULL", r.register_user, eid, other)
    with db() as conn:
        conn.execute("UPDATE public.events SET start_datetime=now()-interval '1 hour' WHERE event_id=%s", (eid,))
    expect("EVENT_ALREADY_STARTED", r.register_user, eid, other)
    expect("EVENT_ALREADY_STARTED", r.cancel_registration, eid, attendee)


def test_cancel_reregister_private_lists_and_cascade(users, db):
    owner, attendee, other, _ = users
    eid = r.create_event(owner, **payload(status="Published", capacity=1))["event_id"]
    reg = r.register_user(eid, attendee)
    expect("REGISTRATION_NOT_FOUND", r.cancel_registration, eid, other)
    expect("USER_NOT_FOUND", r.cancel_registration, eid, uuid4())
    assert r.list_user_registrations(other) == []
    expect("FORBIDDEN", r.list_attendees, eid, other)
    assert r.list_attendees(eid, owner)[0]["user_id"] == attendee
    cancelled = r.cancel_registration(eid, attendee)
    assert cancelled["registration_status"] == "Cancelled"
    assert r.cancel_registration(eid, attendee) == cancelled
    assert r.get_event(eid)["remaining_capacity"] == 1
    rows = r.list_user_registrations(attendee)
    assert len(rows) == 1 and rows[0]["event"]["event_id"] == eid
    assert rows[0]["registration_status"] == "Cancelled"
    assert r.register_user(eid, attendee)["registration_id"] == reg["registration_id"]
    json.dumps(json_ready(r.list_user_registrations(attendee)))
    r.delete_event(eid, owner)
    assert r.list_user_registrations(attendee) == []
    with db() as conn:
        assert conn.execute("SELECT COUNT(*) AS n FROM public.registrations WHERE event_id=%s", (eid,)).fetchone()["n"] == 0


def test_capacity_cannot_drop_below_active_count(users):
    owner, first, second, _ = users
    eid = r.create_event(owner, **payload(status="Published", capacity=30))["event_id"]
    r.register_user(eid, first)
    r.register_user(eid, second)
    expect("CAPACITY_TOO_SMALL", r.update_event, eid, owner, capacity=1, title="Must roll back")
    assert r.get_event(eid)["capacity"] == 30
    assert r.get_event(eid)["title"] == "Python Workshop"
    assert r.update_event(eid, owner, capacity=2)["remaining_capacity"] == 0
    assert r.update_event(eid, owner, capacity=None)["remaining_capacity"] is None
    r.cancel_registration(eid, second)
    assert r.update_event(eid, owner, capacity=1)["remaining_capacity"] == 0


@pytest.mark.skipif(os.getenv("TEST_EMBEDDED") == "1", reason="Concurrency requires full PostgreSQL, not PGlite")
@pytest.mark.parametrize("capacity_edit", [False, True])
def test_concurrent_registration_and_capacity_edit(users, capacity_edit):
    owner, first, second, _ = users
    eid = r.create_event(owner, **payload(status="Published", capacity=2 if capacity_edit else 1))["event_id"]
    if capacity_edit:
        r.register_user(eid, first)
    barrier = Barrier(2)

    def run(which):
        barrier.wait(timeout=15)
        try:
            if capacity_edit and which == 0:
                r.update_event(eid, owner, capacity=1)
                return "updated"
            r.register_user(eid, first if which == 0 else second)
            return "registered"
        except r.DataError as error:
            return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, (0, 1)))
    if capacity_edit:
        assert set(results) in ({"updated", "EVENT_FULL"}, {"CAPACITY_TOO_SMALL", "registered"})
    else:
        assert sorted(results) == ["EVENT_FULL", "registered"]
    event = r.get_event(eid)
    assert event["registration_count"] <= event["capacity"]


def test_pool_reuses_connections_and_commits(db_connect, monkeypatch):
    import data.db as dbmod

    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("DATABASE_SSLMODE", "prefer")
    monkeypatch.setenv("DATABASE_POOL_MAX", "2")
    monkeypatch.setattr(dbmod, "_pool", None)
    email = f"{uuid4()}@example.com"
    try:
        pids = set()
        for _ in range(6):
            with dbmod.connect() as conn:
                pids.add(conn.info.backend_pid)
                assert conn.execute("SELECT 1 AS n").fetchone()["n"] == 1
        # A connection per call would open six backends instead of reusing two.
        assert len(pids) <= 2
        with dbmod.connect() as conn:
            conn.execute("INSERT INTO public.users (name, email) VALUES (%s, %s)", ("Pool user", email))
        with dbmod.connect() as conn:
            # The with-block above must have committed before returning the connection.
            assert conn.execute("SELECT COUNT(*) AS n FROM public.users WHERE email = %s", (email,)).fetchone()["n"] == 1
    finally:
        if dbmod._pool is not None:
            dbmod._pool.close()
        monkeypatch.setattr(dbmod, "_pool", None)
        with db_connect() as conn:
            conn.execute("DELETE FROM public.users WHERE email = %s", (email,))


def test_user_provisioning(db):
    email = f"{uuid4()}@example.com"
    try:
        assert r.find_user_by_email(email) is None
        created = r.create_user(" Ada Lovelace ", email)
        assert created["name"] == "Ada Lovelace" and created["profile_image"] is None
        assert r.get_user(created["user_id"])["user_id"] == created["user_id"]
        # Email uniqueness ignores capitalization.
        assert r.find_user_by_email(email.upper())["user_id"] == created["user_id"]
        expect("EMAIL_TAKEN", r.create_user, "Duplicate", email.upper())
        assert r.get_or_create_user(email, "Ignored")["user_id"] == created["user_id"]
        expect("USER_NOT_FOUND", r.get_user, uuid4())
        expect("INVALID_INPUT", r.create_user, "  ", f"{uuid4()}@example.com")
        expect("INVALID_INPUT", r.create_user, "No at sign", "not-an-email")
        expect("INVALID_INPUT", r.create_user, "Two at signs", "a@b@example.com")
        json.dumps(json_ready(created))
    finally:
        with db() as conn:
            conn.execute("DELETE FROM public.users WHERE lower(email) = lower(%s)", (email,))


def test_get_organizer_event_loads_drafts(users):
    owner, other, *_ = users
    draft = r.create_event(owner, **payload())
    eid = draft["event_id"]
    expect("EVENT_NOT_PUBLISHED", r.get_event, eid)
    loaded = r.get_organizer_event(eid, owner)
    assert loaded["status"] == "Draft" and loaded["organizer_name"] == "Test user"
    assert loaded["registration_count"] == 0 and loaded["remaining_capacity"] is None
    expect("FORBIDDEN", r.get_organizer_event, eid, other)
    expect("EVENT_NOT_FOUND", r.get_organizer_event, uuid4(), owner)


def test_cancelling_event_cancels_registrations(users):
    owner, attendee, other, _ = users
    eid = r.create_event(owner, **payload(status="Published", capacity=5))["event_id"]
    r.register_user(eid, attendee)
    r.register_user(eid, other)
    assert len(r.list_attendees(eid, owner)) == 2

    cancelled = r.update_event(eid, owner, status="Cancelled")
    assert cancelled["status"] == "Cancelled" and cancelled["registration_count"] == 0
    # The organizer must stop seeing people as attending a cancelled event.
    assert r.list_attendees(eid, owner) == []
    rows = r.list_user_registrations(attendee)
    assert len(rows) == 1 and rows[0]["registration_status"] == "Cancelled"
    # The history row survives, unlike a hard delete.
    assert rows[0]["event"]["status"] == "Cancelled"
    assert rows[0]["event"]["organizer_name"] == "Test user"
    expect("EVENT_NOT_PUBLISHED", r.register_user, eid, attendee)

    # Re-publishing does not silently restore anyone.
    r.update_event(eid, owner, status="Published")
    assert r.list_attendees(eid, owner) == []
    assert r.register_user(eid, attendee)["registration_status"] == "Registered"
    assert len(r.list_attendees(eid, owner)) == 1
