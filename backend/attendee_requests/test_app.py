from datetime import datetime

import pytest
import app as attendee_app


@pytest.fixture()
def client(monkeypatch):
    mock_events = [
        {
            "event_id": 101,
            "title": "Mock Tech Meetup",
            "description": "A test event for technology fans.",
            "date_and_time_start": datetime(2027, 6, 12, 18, 0),
            "date_and_time_end": datetime(2027, 6, 12, 20, 0),
            "category": "technology",
            "location": "Test Hall",
            "Organizer": "Test Organizer",
            "status": "published",
        },
        {
            "event_id": 102,
            "title": "Mock Draft Event",
            "description": "This should not appear publicly.",
            "date_and_time_start": datetime(2027, 7, 12, 18, 0),
            "date_and_time_end": datetime(2027, 7, 12, 20, 0),
            "category": "music",
            "location": "Test Room",
            "Organizer": "Test Organizer",
            "status": "draft",
        },
    ]

    monkeypatch.setattr(attendee_app, "events", mock_events)
    monkeypatch.setattr(attendee_app, "registrations", [])
    attendee_app.app.config["TESTING"] = True

    with attendee_app.app.test_client() as test_client:
        yield test_client


def test_events_returns_only_published_mock_events(client):
    response = client.get("/events")

    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["event_id"] == 101


def test_event_details_returns_mock_event(client):
    response = client.get("/events/101")

    assert response.status_code == 200
    assert response.json["title"] == "Mock Tech Meetup"


def test_draft_event_details_returns_404(client):
    response = client.get("/events/102")

    assert response.status_code == 404


def test_attendee_can_register_for_mock_event(client):
    response = client.post(
        "/events/101/registrations",
        json={"attendee_id": 42},
    )

    assert response.status_code == 201
    assert response.json["event_id"] == 101
    assert response.json["attendee_id"] == 42
    assert response.json["registration_status"] == "registered"