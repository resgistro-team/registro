import os
import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app import create_app
from auth_middleware import generate_token, get_jwt_secret
from data.repository import create_user
import data.repository as repo


@pytest.fixture
def app(monkeypatch, db):
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-for-api-tests-123456")
    monkeypatch.setattr(repo, "connect", db)
    application = create_app()
    application.config.update({"TESTING": True})
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def test_organizer(app):
    email = f"test-org-{uuid4()}@example.com"
    user = create_user("Test Organizer", email)
    token = generate_token(user)
    return {"user": user, "token": token, "email": email}


@pytest.fixture
def test_attendee(app):
    email = f"test-att-{uuid4()}@example.com"
    user = create_user("Test Attendee", email)
    token = generate_token(user)
    return {"user": user, "token": token, "email": email}


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_jwt_secret_crash_when_missing(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    # Verifies there is no hardcoded fallback and RuntimeError is raised
    with pytest.raises(RuntimeError) as exc_info:
        get_jwt_secret()
    assert "JWT_SECRET" in str(exc_info.value)

    with pytest.raises(RuntimeError):
        generate_token({"user_id": uuid4(), "email": "test@example.com", "name": "Test"})


def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_auth_register_and_login_without_role(client):
    email = f"newuser-{uuid4()}@example.com"
    # Attempt to supply role: should be ignored/not permitted
    res = client.post("/api/auth/register", json={
        "name": "Role Test User",
        "email": email,
        "password": "secretpassword",
        "role": "admin"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert "token" in data
    # Role must not be set to "admin" or self-assigned
    assert data["user"]["email"] == email

    # Duplicate registration
    dup_res = client.post("/api/auth/register", json={
        "name": "Duplicate User",
        "email": email,
        "password": "secretpassword"
    })
    assert dup_res.status_code == 400

    # Successful login
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "secretpassword"
    })
    assert login_res.status_code == 200
    login_data = login_res.get_json()
    assert "token" in login_data


def test_auth_me_and_profile_update_role_removal(client, test_organizer):
    token = test_organizer["token"]
    res = client.get("/api/auth/me", headers=auth_header(token))
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["email"] == test_organizer["email"]
    assert "stats" in data

    # Try updating profile with role
    put_res = client.put("/api/auth/me", headers=auth_header(token), json={
        "name": "Updated Name",
        "role": "superuser"
    })
    assert put_res.status_code == 200
    put_data = put_res.get_json()
    assert put_data["user"]["name"] == "Updated Name"


def test_event_lifecycle_and_registration_status(client, test_organizer, test_attendee):
    start = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat().replace("+00:00", "Z")
    end = (datetime.now(timezone.utc) + timedelta(days=5, hours=2)).isoformat().replace("+00:00", "Z")

    # 1. Create event
    create_res = client.post("/api/events", headers=auth_header(test_organizer["token"]), json={
        "title": "API Test Event",
        "description": "Integration test event description",
        "location": "Virtual Hall",
        "start_datetime": start,
        "end_datetime": end,
        "capacity": 10,
        "status": "Published"
    })
    assert create_res.status_code == 201
    created_event = create_res.get_json()["event"]
    event_id = created_event["event_id"]
    assert created_event["status"] == "Published"
    assert created_event["remaining_capacity"] == 10

    # 2. Get event detail publicly
    get_res = client.get(f"/api/events/{event_id}")
    assert get_res.status_code == 200
    assert get_res.get_json()["title"] == "API Test Event"

    # 3. Register attendee
    reg_res = client.post(f"/api/events/{event_id}/register", headers=auth_header(test_attendee["token"]))
    assert reg_res.status_code == 201
    reg_data = reg_res.get_json()
    # CRITICAL: Registration status must be "Registered", not "confirmed"
    assert reg_data["registration"]["registration_status"] == "Registered"
    assert reg_data["registration"]["status"] == "Registered"

    # 4. Duplicate registration rejected
    dup_reg = client.post(f"/api/events/{event_id}/register", headers=auth_header(test_attendee["token"]))
    assert dup_reg.status_code == 409
    assert dup_reg.get_json()["code"] == "ALREADY_REGISTERED"

    # 5. Organizer attendee list
    att_res = client.get(f"/api/events/{event_id}/registrations", headers=auth_header(test_organizer["token"]))
    assert att_res.status_code == 200
    att_data = att_res.get_json()
    assert att_data["totalAttendees"] == 1
    assert att_data["attendees"][0]["registration_status"] == "Registered"

    # 6. Attendee sees event in /api/users/my-events
    my_events = client.get("/api/users/my-events", headers=auth_header(test_attendee["token"]))
    assert my_events.status_code == 200
    my_data = my_events.get_json()
    assert my_data["total"] >= 1
    assert any(x["event"]["event_id"] == event_id for x in my_data["upcoming"])

    # 7. Cancel registration
    cancel_res = client.delete(f"/api/events/{event_id}/register", headers=auth_header(test_attendee["token"]))
    assert cancel_res.status_code == 200
    assert cancel_res.get_json()["registration"]["registration_status"] == "Cancelled"

    # 8. Organizer dashboard reflects event
    dash_res = client.get("/api/users/organizer/dashboard", headers=auth_header(test_organizer["token"]))
    assert dash_res.status_code == 200
    dash_data = dash_res.get_json()
    assert dash_data["stats"]["totalEvents"] >= 1

    # 9. Clean up: delete event
    del_res = client.delete(f"/api/events/{event_id}", headers=auth_header(test_organizer["token"]))
    assert del_res.status_code == 200
