from flask import jsonify
import data.repository as repo
from data.json_helpers import json_ready

STATUS_MAP = {
    "EVENT_NOT_FOUND": 404,
    "EVENT_NOT_PUBLISHED": 409,
    "EVENT_ALREADY_STARTED": 409,
    "USER_NOT_FOUND": 404,
    "ALREADY_REGISTERED": 409,
    "EVENT_FULL": 409,
    "FORBIDDEN": 403,
    "CAPACITY_TOO_SMALL": 409,
    "REGISTRATION_NOT_FOUND": 404,
    "INVALID_INPUT": 400,
    "EMAIL_TAKEN": 409,
    "UNAUTHORIZED": 401,
}


def send_error(code, message, status_code=None):
    if status_code is None:
        status_code = STATUS_MAP.get(code, 400)
    return jsonify({
        "code": code,
        "error": {
            "code": code,
            "message": message
        },
        "message": message
    }), status_code


def enrich_event(event, current_user_id=None):
    if not event:
        return event

    res = dict(event)
    eid = str(res["event_id"])
    res["id"] = eid
    res["event_id"] = eid
    res["organizerId"] = str(res["organizer_id"])
    res["organizer_id"] = str(res["organizer_id"])
    res["organizerName"] = res.get("organizer_name")

    registered_count = res.get("registration_count", 0)
    res["registeredCount"] = registered_count

    capacity = res.get("capacity")
    remaining = res.get("remaining_capacity")
    res["spotsLeft"] = remaining
    res["isSoldOut"] = (remaining == 0) if (capacity is not None and capacity > 0) else False

    is_user_registered = False
    user_reg_data = None

    if current_user_id:
        try:
            # Use repo.connect so the conftest monkeypatch applies correctly
            with repo.connect() as conn:
                row = conn.execute(
                    """SELECT registration_id, event_id, user_id, registration_status, registered_at
                       FROM public.registrations
                       WHERE event_id = %s AND user_id = %s AND registration_status = 'Registered'""",
                    (eid, current_user_id)
                ).fetchone()
                if row:
                    is_user_registered = True
                    user_reg_data = json_ready(dict(row))
                    # Ensure status matches DATA_CONTRACT ("Registered")
                    user_reg_data["status"] = "Registered"
        except Exception:
            pass

    res["isUserRegistered"] = is_user_registered
    res["userRegistration"] = user_reg_data

    return json_ready(res)
