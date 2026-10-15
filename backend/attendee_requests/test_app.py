import os

# Use a local in-memory database for this test process, not Supabase.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
import app as attendee_app


@pytest.fixture()
def client():
    with attendee_app.app.app_context():
        attendee_app.db.drop_all()
        attendee_app.db.create_all()

        attendee_app.db.session.add_all([
            attendee_app.Event(
                event_id=101,
                title="Mock Tech Meetup",
                description="A test event for technology fans.",
                category="technology",
                location="Test Hall",
                start_datetime=None,
                status="published",
                capacity=10,
            ),
            attendee_app.Event(
                event_id=102,
                title="Mock Draft Event",
                description="This should not appear publicly.",
                category="music",
                location="Test Room",
                start_datetime=None,
                status="draft",
                capacity=10,
            ),
        ])
        attendee_app.db.session.commit()

        yield attendee_app.app.test_client()

        attendee_app.db.session.remove()
        attendee_app.db.drop_all()


def test_events_returns_only_published_events(client):
    response = client.get("/events")

    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["event_id"] == 101


def test_event_details_returns_event(client):
    response = client.get("/events/101")

    assert response.status_code == 200
    assert response.json["title"] == "Mock Tech Meetup"


def test_draft_event_details_returns_404(client):
    response = client.get("/events/102")

    assert response.status_code == 404


def test_attendee_can_register(client):
    response = client.post(
        "/events/101/registrations",
        json={"attendee_id": 42},
    )

    assert response.status_code == 201
    assert response.json["event_id"] == 101
    assert response.json["user_id"] == 42
    assert response.json["registration_status"] == "registered"


def test_duplicate_registration_returns_conflict(client):
    client.post("/events/101/registrations", json={"attendee_id": 42})

    response = client.post(
        "/events/101/registrations",
        json={"attendee_id": 42},
    )

    assert response.status_code == 409