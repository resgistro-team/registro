"""Talks to the Registro API on the user's behalf.

The MCP server never touches the database. It calls the same API the website uses, so the
same rules apply to an AI assistant as to a person: no double registration, no registering
for a full event, drafts stay private.
"""
import os

import httpx

API_URL = os.environ.get("REGISTRO_API_URL", "https://registro-api-eight.vercel.app").rstrip("/")

# Tests swap this for an httpx.MockTransport, so they never reach the real API.
transport: httpx.AsyncBaseTransport | None = None


class RegistroError(Exception):
    """A request Registro refused. The message is written for the person, and the assistant relays it."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


# The API's error codes, said the way you'd say them to the person asking.
FRIENDLY = {
    "EVENT_NOT_FOUND": "That event doesn't exist. It may have been deleted.",
    "EVENT_NOT_PUBLISHED": "That event isn't open yet, so it can't be viewed or joined.",
    "EVENT_ALREADY_STARTED": "That event has already started, so registration is closed.",
    "ALREADY_REGISTERED": "You're already registered for that event.",
    "EVENT_FULL": "That event is full. There are no spots left.",
    "REGISTRATION_NOT_FOUND": "You aren't registered for that event.",
    "UNAUTHORIZED": "Your Registro sign-in has expired. Reconnect Registro to sign in again.",
    "FORBIDDEN": "Your account isn't allowed to do that.",
}


async def request(method: str, path: str, *, token: str | None = None, params: dict | None = None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(base_url=API_URL, transport=transport, timeout=20) as client:
        try:
            response = await client.request(method, path, headers=headers, params=params)
        except httpx.HTTPError as error:
            raise RegistroError("UNREACHABLE", "Registro isn't responding right now. Try again in a moment.") from error

    if response.is_success:
        return response.json()

    try:
        body = response.json()
    except ValueError:
        body = {}
    code = body.get("code") or (body.get("error") or {}).get("code") or f"HTTP_{response.status_code}"
    message = FRIENDLY.get(code) or body.get("message") or "Registro couldn't complete that request."
    raise RegistroError(code, message)
