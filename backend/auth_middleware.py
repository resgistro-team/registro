import json
import os
from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import request, jsonify, g


class AuthenticationError(ValueError):
    """The bearer token is missing, invalid, expired, or lacks required claims."""


def _supabase_config():
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    # SUPABASE_ANON_KEY remains accepted for projects that have not migrated to
    # Supabase's publishable-key naming.
    api_key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not api_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) "
            "must be configured."
        )
    return url, api_key


def verify_supabase_access_token(token):
    """Verify an access token with Supabase Auth and return its user object.

    Calling Auth's user endpoint supports both legacy HS256 projects and newer
    asymmetric signing keys, and enforces Supabase's expiry and revocation rules.
    """
    url, api_key = _supabase_config()
    request_to_supabase = Request(
        f"{url}/auth/v1/user",
        headers={"apikey": api_key, "Authorization": f"Bearer {token}"},
        method="GET",
    )
    try:
        with urlopen(request_to_supabase, timeout=5) as response:
            user = json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise AuthenticationError("Invalid or expired session.") from error

    if not isinstance(user, dict):
        raise AuthenticationError("Invalid user response from authentication provider.")
    return user


def _resolve_user(token):
    identity = verify_supabase_access_token(token)
    email = identity.get("email")
    metadata = identity.get("user_metadata") or {}
    full_name = metadata.get("full_name")
    if not isinstance(email, str) or not isinstance(full_name, str) or not full_name.strip():
        raise AuthenticationError("The authenticated user is missing email or full_name metadata.")

    from data.repository import get_or_create_user
    return get_or_create_user(email=email, name=full_name)


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
            g.user = _resolve_user(token)
        except RuntimeError:
            raise
        except AuthenticationError:
            return jsonify({
                "code": "UNAUTHORIZED",
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or expired session. Please sign in again."
                },
                "message": "Invalid or expired session. Please sign in again."
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
                g.user = _resolve_user(token)
            except RuntimeError:
                raise
            except Exception:
                g.user = None
        return f(*args, **kwargs)
    return decorated
