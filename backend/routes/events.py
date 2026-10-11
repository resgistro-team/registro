from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from flask import Blueprint, request, jsonify, g
from auth_middleware import require_auth, optional_auth
import data.repository as repo
from data.json_helpers import json_ready
from helpers import send_error, enrich_event

DataError = repo.DataError

events_bp = Blueprint("events", __name__)


def _extract_event_fields(data):
    fields = {}
    if "title" in data:
        fields["title"] = data["title"]
    if "description" in data:
        fields["description"] = data["description"]
    if "location" in data:
        fields["location"] = data["location"]

    # Support camelCase and snake_case
    start = data.get("start_datetime") or data.get("startDatetime")
    if start is not None:
        fields["start_datetime"] = start

    end = data.get("end_datetime") or data.get("endDatetime")
    if end is not None:
        fields["end_datetime"] = end

    if "image" in data:
        fields["image"] = data["image"]
    if "category" in data:
        fields["category"] = data["category"]

    if "capacity" in data:
        fields["capacity"] = data["capacity"]

    if "status" in data:
        fields["status"] = data["status"]

    return fields


# ==========================================
# ORGANIZER EVENT ENDPOINTS (Ahmed's part)
# ==========================================

@events_bp.route("/organizer", methods=["GET"])
@require_auth
def get_organizer_events_list():
    try:
        events = repo.list_organizer_events(g.user["user_id"])
        enriched = [enrich_event(e, g.user["user_id"]) for e in events]
        return jsonify(enriched), 200
    except DataError as err:
        return send_error(err.code, err.message)


@events_bp.route("/organizer/<event_id>", methods=["GET"])
@require_auth
def get_organizer_event_detail(event_id):
    try:
        event = repo.get_organizer_event(event_id, g.user["user_id"])
        attendees = repo.list_attendees(event_id, g.user["user_id"])
        enriched = enrich_event(event, g.user["user_id"])
        enriched["attendees"] = json_ready(attendees)
        return jsonify(enriched), 200
    except DataError as err:
        return send_error(err.code, err.message)


@events_bp.route("", methods=["POST"])
@require_auth
def create_new_event():
    data = request.get_json(silent=True) or {}
    fields = _extract_event_fields(data)

    try:
        created = repo.create_event(g.user["user_id"], **fields)
        enriched = enrich_event(created, g.user["user_id"])
        return jsonify({
            "message": "Event created successfully!",
            "event": enriched
        }), 201
    except DataError as err:
        return send_error(err.code, err.message)


def _handle_update(event_id):
    data = request.get_json(silent=True) or {}
    fields = _extract_event_fields(data)

    try:
        updated = repo.update_event(event_id, g.user["user_id"], **fields)
        enriched = enrich_event(updated, g.user["user_id"])
        return jsonify({
            "message": "Event updated successfully!",
            "event": enriched
        }), 200
    except DataError as err:
        return send_error(err.code, err.message)


@events_bp.route("/<event_id>", methods=["PUT"])
@require_auth
def put_event(event_id):
    return _handle_update(event_id)


@events_bp.route("/<event_id>", methods=["PATCH"])
@require_auth
def patch_event(event_id):
    return _handle_update(event_id)


@events_bp.route("/<event_id>/status", methods=["PATCH"])
@require_auth
def patch_event_status(event_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return send_error("INVALID_INPUT", "status is required.")

    try:
        updated = repo.update_event(event_id, g.user["user_id"], status=status)
        enriched = enrich_event(updated, g.user["user_id"])
        return jsonify({
            "message": "Event updated successfully!",
            "event": enriched
        }), 200
    except DataError as err:
        return send_error(err.code, err.message)


@events_bp.route("/<event_id>", methods=["DELETE"])
@require_auth
def remove_event(event_id):
    try:
        repo.delete_event(event_id, g.user["user_id"])
        return jsonify({
            "success": True,
            "message": "Event deleted successfully."
        }), 200
    except DataError as err:
        return send_error(err.code, err.message)


@events_bp.route("/<event_id>/registrations", methods=["GET"])
@require_auth
def get_event_registrations(event_id):
    try:
        event = repo.get_organizer_event(event_id, g.user["user_id"])
        attendees = repo.list_attendees(event_id, g.user["user_id"])
        return jsonify({
            "eventId": str(event["event_id"]),
            "eventTitle": event["title"],
            "capacity": event["capacity"],
            "totalAttendees": len(attendees),
            "attendees": json_ready(attendees)
        }), 200
    except DataError as err:
        return send_error(err.code, err.message)


# ==========================================
# PUBLIC & ATTENDEE ENDPOINTS
# ==========================================

@events_bp.route("", methods=["GET"])
@optional_auth
def list_and_search_events():
    category = request.args.get("category")
    search = request.args.get("search") or request.args.get("query")
    date_filter = request.args.get("dateFilter")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    organizer_id = request.args.get("organizerId")
    sort = request.args.get("sort")

    user_id = g.user["user_id"] if g.user else None

    # Organizer filter
    if organizer_id:
        try:
            events = repo.search_events(organizer_id=organizer_id)
            enriched = [enrich_event(e, user_id) for e in events]
            return jsonify(enriched), 200
        except DataError as err:
            return send_error(err.code, err.message)

    # Date filter shortcuts
    now = datetime.now(timezone.utc)
    if date_filter:
        if date_filter == "today":
            eastern = ZoneInfo("America/New_York")
            local_today = now.astimezone(eastern).date()
            date_from = datetime.combine(local_today, datetime.min.time(), tzinfo=eastern).isoformat()
            date_to = datetime.combine(local_today + timedelta(days=1), datetime.min.time(), tzinfo=eastern).isoformat()
        elif date_filter == "this_week":
            date_from = now.isoformat().replace("+00:00", "Z")
            date_to = (now + timedelta(days=7)).isoformat().replace("+00:00", "Z")
        elif date_filter == "upcoming":
            date_from = now.isoformat().replace("+00:00", "Z")

    if category and category.lower() == "all":
        category = None

    try:
        events = repo.search_events(
            query=search,
            category=category,
            date_from=date_from,
            date_to=date_to
        )
    except DataError as err:
        return send_error(err.code, err.message)

    enriched = [enrich_event(e, user_id) for e in events]

    # Client sorting
    if sort == "popular":
        enriched.sort(key=lambda x: x.get("registration_count", 0), reverse=True)
    elif sort == "newest":
        enriched.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    else:
        # Default start time
        enriched.sort(key=lambda x: x.get("start_datetime", ""))

    return jsonify(enriched), 200


@events_bp.route("/<event_id>", methods=["GET"])
@optional_auth
def get_event_detail(event_id):
    user_id = g.user["user_id"] if g.user else None

    try:
        event = repo.get_event(event_id)
    except DataError as err:
        # If unpublished and current user is the owner, allow owner to view draft
        if err.code == "EVENT_NOT_PUBLISHED" and user_id:
            try:
                event = repo.get_organizer_event(event_id, user_id)
            except DataError:
                return send_error(err.code, err.message)
        else:
            return send_error(err.code, err.message)

    is_owner = user_id and str(event["organizer_id"]) == str(user_id)
    enriched = enrich_event(event, user_id)
    if is_owner:
        try:
            attendees = repo.list_attendees(event_id, user_id)
            enriched["attendees"] = json_ready(attendees)
        except Exception:
            pass

    return jsonify(enriched), 200


@events_bp.route("/<event_id>/register", methods=["POST"])
@require_auth
def register_for_event(event_id):
    try:
        reg = repo.register_user(event_id, g.user["user_id"])
        # Ensure registration status is "Registered" per DATA_CONTRACT.md
        reg_ready = json_ready(dict(reg))
        reg_ready["status"] = "Registered"

        # Fetch updated event detail
        try:
            ev = repo.get_event(event_id)
            enriched_event = enrich_event(ev, g.user["user_id"])
        except Exception:
            enriched_event = None

        return jsonify({
            "message": "Successfully registered for event!",
            "registration": reg_ready,
            "event": enriched_event
        }), 201
    except DataError as err:
        return send_error(err.code, err.message)


@events_bp.route("/<event_id>/register", methods=["DELETE"])
@require_auth
def cancel_event_registration(event_id):
    try:
        reg = repo.cancel_registration(event_id, g.user["user_id"])
        reg_ready = json_ready(dict(reg))

        try:
            ev = repo.get_event(event_id)
            enriched_event = enrich_event(ev, g.user["user_id"])
        except Exception:
            enriched_event = None

        return jsonify({
            "message": "Registration cancelled successfully.",
            "registration": reg_ready,
            "event": enriched_event
        }), 200
    except DataError as err:
        return send_error(err.code, err.message)
