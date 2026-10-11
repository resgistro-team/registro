from flask import Blueprint, request, jsonify, g
from auth_middleware import require_auth
import data.repository as repo
from data.json_helpers import json_ready
from helpers import send_error

DataError = repo.DataError

auth_bp = Blueprint("auth", __name__)


def _sanitize_user(user):
    res = dict(user)
    uid = str(res.get("user_id") or res.get("id"))
    res["id"] = uid
    res["user_id"] = uid
    if "password" in res:
        del res["password"]
    # Users do not have self-assigned roles; default to standard attendee/organizer capability
    return json_ready(res)


@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    user = g.user
    registrations = repo.list_user_registrations(user["user_id"])
    active_regs = [r for r in registrations if r.get("registration_status") == "Registered"]
    organized = repo.list_organizer_events(user["user_id"])

    return jsonify({
        "user": _sanitize_user(user),
        "stats": {
            "registeredCount": len(active_regs),
            "organizedCount": len(organized)
        }
    }), 200


@auth_bp.route("/me", methods=["PUT"])
@require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    avatar = data.get("avatar") or data.get("profile_image")
    # Disallow user-specified role update:
    # "users can set their own role at signup and on profile update. remove that"

    try:
        updated_user = repo.update_user(
            g.user["user_id"],
            name=name if name is not None else repo.UNSET,
            profile_image=avatar if avatar is not None else repo.UNSET,
        )
    except DataError as err:
        return send_error(err.code, err.message)
    return jsonify({"user": _sanitize_user(updated_user)}), 200
