from flask import jsonify
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
    """Convert repository event data at the HTTP boundary without extra queries.

    ``current_user_id`` is retained temporarily for route-call compatibility; the
    public event contract deliberately does not add per-user or camelCase fields.
    """
    del current_user_id
    return json_ready(event) if event else event
