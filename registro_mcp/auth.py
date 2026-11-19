"""Who is asking: sign-in for the MCP server.

Registro already signs people in with Supabase Auth, and Supabase can act as an OAuth 2.1
server. So when someone connects Registro to Claude or ChatGPT:

1. The assistant asks this server for a tool and is told it needs a token, and where to get one
   (the protected-resource metadata the SDK serves at /.well-known/oauth-protected-resource).
2. The assistant registers itself with Supabase and sends the person to Registro's consent
   screen (frontend: /oauth/consent), where they sign in and press Allow.
3. Supabase gives the assistant an access token for that person.
4. Every tool call carries the token. This module checks it with Supabase, and the tools pass
   it on to the Registro API, which checks it again. The assistant acts as that person, never
   as an admin.
"""
import base64
import json
import os
import time

import httpx
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")

# Tests swap this for an httpx.MockTransport.
transport: httpx.AsyncBaseTransport | None = None

# A checked token is trusted for a short while, so one conversation doesn't ask Supabase
# about the same token on every single tool call. Short enough that signing out still bites fast.
_CACHE_SECONDS = 60
_checked: dict[str, tuple[float, AccessToken]] = {}


def _claims(token: str) -> dict:
    """Read a JWT's claims without checking the signature. Only used after Supabase has vouched for it."""
    try:
        payload = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError):
        return {}


class SupabaseTokenVerifier:
    """Accepts a token only if Supabase says it belongs to a real, signed-in Registro user."""

    async def verify_token(self, token: str) -> AccessToken | None:
        now = time.monotonic()
        cached = _checked.get(token)
        if cached and now - cached[0] < _CACHE_SECONDS:
            return cached[1]

        async with httpx.AsyncClient(transport=transport, timeout=5) as client:
            try:
                response = await client.get(
                    f"{SUPABASE_URL}/auth/v1/user",
                    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
                )
            except httpx.HTTPError:
                return None
        if response.status_code != 200:
            return None

        user = response.json()
        claims = _claims(token)
        access = AccessToken(
            token=token,
            client_id=str(claims.get("client_id") or "registro"),
            scopes=[],
            expires_at=claims.get("exp"),
            subject=user.get("id"),
        )
        _checked[token] = (now, access)
        return access


def current_token() -> str | None:
    """The signed-in person's token for this tool call.

    Over HTTP it comes from the request, already verified. Run locally over stdio (for testing
    in Claude Desktop or the MCP Inspector), there's no sign-in screen, so it comes from the
    REGISTRO_ACCESS_TOKEN environment variable instead.
    """
    access = get_access_token()
    if access:
        return access.token
    return os.environ.get("REGISTRO_ACCESS_TOKEN") or None
