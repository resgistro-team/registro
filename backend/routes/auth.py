from flask import Blueprint, request, jsonify, g
from auth_middleware import generate_token, require_auth
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


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    avatar = data.get("avatar") or data.get("profile_image")

    # Disallow user-specified role per security requirements
    # "users can set their own role at signup and on profile update. remove that"

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400

    try:
        new_user = repo.create_user(name=name, email=email, profile_image=avatar)
    except DataError as err:
        if err.code == "EMAIL_TAKEN":
            return jsonify({
                "code": "EMAIL_TAKEN",
                "error": "An account with this email already exists.",
                "message": "An account with this email already exists."
            }), 400
        return send_error(err.code, err.message)

    token = generate_token(new_user)
    return jsonify({
        "message": "Account created successfully",
        "user": _sanitize_user(new_user),
        "token": token
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = repo.find_user_by_email(email)
    if not user:
        return jsonify({"error": "Invalid email or password."}), 401

    token = generate_token(user)
    return jsonify({
        "message": "Signed in successfully",
        "user": _sanitize_user(user),
        "token": token
    }), 200


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

    updates = []
    params = []
    if name is not None and isinstance(name, str) and name.strip():
        updates.append("name = %s")
        params.append(name.strip())
    if avatar is not None:
        updates.append("profile_image = %s")
        params.append(avatar.strip() if isinstance(avatar, str) and avatar.strip() else None)

    if updates:
        params.append(g.user["user_id"])
        with repo.connect() as conn:
            conn.execute(
                f"UPDATE public.users SET {', '.join(updates)} WHERE user_id = %s",
                params
            )

    updated_user = repo.get_user(g.user["user_id"])
    return jsonify({"user": _sanitize_user(updated_user)}), 200


@auth_bp.route("/demo-users", methods=["GET"])
def get_demo_users():
    with repo.connect() as conn:
        users = conn.execute("SELECT * FROM public.users ORDER BY created_at").fetchall()
    return jsonify([_sanitize_user(u) for u in users]), 200


@auth_bp.route("/switch-demo", methods=["POST"])
def switch_demo():
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")
    if not user_id:
        return jsonify({"error": "Demo user ID is required."}), 400

    try:
        user = repo.get_user(user_id)
    except DataError:
        return jsonify({"error": "Demo user not found."}), 404

    token = generate_token(user)
    return jsonify({
        "message": f"Switched to {user['name']}",
        "user": _sanitize_user(user),
        "token": token
    }), 200
