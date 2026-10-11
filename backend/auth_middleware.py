import os
from functools import wraps
from flask import request, jsonify, g
import jwt

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is missing or empty. "
        "Server cannot start securely without a valid JWT_SECRET configured."
    )


def generate_token(user):
    user_id = str(user.get("user_id") or user.get("id"))
    payload = {
        "id": user_id,
        "user_id": user_id,
        "email": user.get("email"),
        "name": user.get("name"),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({
                "code": "UNAUTHORIZED",
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Authentication required. Please sign in."
                },
                "message": "Authentication required. Please sign in."
            }), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = decoded.get("user_id") or decoded.get("id")
            from data.repository import get_user, DataError
            user = get_user(user_id)
            g.user = user
        except jwt.PyJWTError:
            return jsonify({
                "code": "UNAUTHORIZED",
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or expired session. Please sign in again."
                },
                "message": "Invalid or expired session. Please sign in again."
            }), 401
        except DataError as e:
            if e.code == "USER_NOT_FOUND":
                return jsonify({
                    "code": "USER_NOT_FOUND",
                    "error": {
                        "code": "USER_NOT_FOUND",
                        "message": "User not found. Please sign in again."
                    },
                    "message": "User not found. Please sign in again."
                }), 401
            return jsonify({
                "code": e.code,
                "error": {"code": e.code, "message": e.message},
                "message": e.message
            }), 401
        except Exception:
            return jsonify({
                "code": "UNAUTHORIZED",
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or expired session. Please sign in again."
                },
                "message": "Invalid or expired session. Please sign in again."
            }), 401

        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        g.user = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            try:
                decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                user_id = decoded.get("user_id") or decoded.get("id")
                from data.repository import get_user
                g.user = get_user(user_id)
            except Exception:
                g.user = None
        return f(*args, **kwargs)
    return decorated
