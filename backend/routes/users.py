from datetime import datetime, timezone
from flask import Blueprint, jsonify, g
from auth_middleware import require_auth
import data.repository as repo
from data.json_helpers import json_ready
from helpers import send_error, enrich_event

DataError = repo.DataError

users_bp = Blueprint("users", __name__)


@users_bp.route("/my-events", methods=["GET"])
@require_auth
def get_my_events():
    user_id = g.user["user_id"]
    try:
        registrations = repo.list_user_registrations(user_id)
    except DataError as err:
        return send_error(err.code, err.message)

    now = datetime.now(timezone.utc)
    upcoming = []
    past = []

    for reg in registrations:
        ev = reg.get("event") or {}
        start_dt = ev.get("start_datetime")
        item = {
            "registration": json_ready({
                "registration_id": reg.get("registration_id"),
                "event_id": reg.get("event_id"),
                "user_id": reg.get("user_id"),
                "registration_status": reg.get("registration_status"),
                "registered_at": reg.get("registered_at"),
                "status": reg.get("registration_status")
            }),
            "event": enrich_event(ev, user_id)
        }

        if start_dt:
            # start_dt could be datetime or str
            dt_val = start_dt if isinstance(start_dt, datetime) else datetime.fromisoformat(str(start_dt).replace("Z", "+00:00"))
            if dt_val >= now:
                upcoming.append(item)
            else:
                past.append(item)
        else:
            past.append(item)

    upcoming.sort(key=lambda x: str(x["event"].get("start_datetime", "")))
    past.sort(key=lambda x: str(x["event"].get("start_datetime", "")), reverse=True)

    return jsonify({
        "total": len(registrations),
        "upcoming": upcoming,
        "past": past
    }), 200


@users_bp.route("/organizer/dashboard", methods=["GET"])
@require_auth
def get_organizer_dashboard():
    user_id = g.user["user_id"]
    try:
        events = repo.list_organizer_events(user_id)
    except DataError as err:
        return send_error(err.code, err.message)

    total_registrations = 0
    total_capacity = 0
    enriched_events = []

    for ev in events:
        eid = ev["event_id"]
        reg_count = ev.get("registration_count", 0)
        cap = ev.get("capacity") or 0
        total_registrations += reg_count
        total_capacity += cap

        fill_pct = round((reg_count / cap) * 100) if cap > 0 else 0

        enriched = enrich_event(ev, user_id)
        enriched["fillPercentage"] = fill_pct

        try:
            attendees = repo.list_attendees(eid, user_id)
            enriched["attendees"] = json_ready(attendees[:10])
        except Exception:
            enriched["attendees"] = []

        enriched_events.append(enriched)

    published_count = len([e for e in events if e.get("status") == "Published"])
    draft_count = len([e for e in events if e.get("status") == "Draft"])
    cancelled_count = len([e for e in events if e.get("status") == "Cancelled"])

    avg_fill_rate = round((total_registrations / total_capacity) * 100) if total_capacity > 0 else 0

    return jsonify({
        "stats": {
            "totalEvents": len(events),
            "publishedCount": published_count,
            "draftCount": draft_count,
            "cancelledCount": cancelled_count,
            "totalRegistrations": total_registrations,
            "totalCapacity": total_capacity,
            "averageFillRate": avg_fill_rate
        },
        "events": enriched_events
    }), 200
