"""Registro's MCP server: lets AI assistants (Claude, ChatGPT, Gemini) use Registro.

An AI assistant can't click around a website. MCP gives it a menu of "tools" instead: each
tool has a name, a description and typed inputs. The assistant reads the menu, picks the tool
that fits what the person asked, calls it, and reads the result back to them.

Run it two ways:
  python server.py          over stdio, for local testing (MCP Inspector, Claude Desktop)
  `app` below               over HTTP with sign-in, for hosting (what Claude and ChatGPT connect to)
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from urllib.parse import urlparse

from mcp.server import MCPServer
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field

import registro_api
from auth import SUPABASE_URL, SupabaseTokenVerifier, current_token
from registro_api import RegistroError

# Where this server is reachable once hosted, e.g. https://registro-mcp.vercel.app/mcp.
# Set it (with SUPABASE_URL) to turn on sign-in; leave it unset for local stdio testing.
PUBLIC_URL = os.environ.get("MCP_PUBLIC_URL", "").rstrip("/")
SIGN_IN = bool(PUBLIC_URL and SUPABASE_URL)

INSTRUCTIONS = """Registro is where people find events and save their spot: concerts, workshops,
games, meetups. Use these tools to find events, explain them, and register the person.
Before registering someone, confirm the exact event (title and time) with them.
Times are ISO 8601 in UTC; say them in the person's local time when you can."""

mcp = MCPServer(
    "Registro",
    instructions=INSTRUCTIONS,
    website_url="https://registro.world",
    # With sign-in on, the SDK refuses calls without a valid token and tells the assistant to
    # get one from Supabase, Registro's sign-in provider.
    token_verifier=SupabaseTokenVerifier() if SIGN_IN else None,
    auth=AuthSettings(
        issuer_url=f"{SUPABASE_URL}/auth/v1",
        resource_server_url=PUBLIC_URL,
        # Supabase tokens are issued to Registro users, not to one particular server, so the
        # verifier checks the person instead of the token's audience.
        validate_token_resource=False,
    )
    if SIGN_IN
    else None,
)

READ = ToolAnnotations(read_only_hint=True, open_world_hint=False)

When = Literal["today", "this_week", "upcoming"]


def summarize(event: dict) -> dict:
    """Only what an assistant needs to talk about an event. Less to read means fewer mistakes."""
    capacity = event.get("capacity")
    going = event.get("registration_count") or 0
    return {
        "event_id": event["event_id"],
        "title": event["title"],
        "category": event.get("category"),
        "starts": event["start_datetime"],
        "ends": event["end_datetime"],
        "location": event.get("location"),
        "spots_left": None if capacity is None else max(capacity - going, 0),
        "going": going,
        "link": f"https://registro.world/events/{event['event_id']}",
    }


def signed_in_token() -> str:
    token = current_token()
    if not token:
        raise ToolError("You need to sign in to Registro for this. Connect Registro in your assistant's settings.")
    return token


async def call(method: str, path: str, *, token: str | None = None, params: dict | None = None):
    """Call the API and turn its refusals into a sentence the assistant can pass on."""
    try:
        return await registro_api.request(method, path, token=token, params=params)
    except RegistroError as error:
        raise ToolError(str(error)) from error


@mcp.tool(title="Search events", annotations=READ)
async def search_events(
    query: Annotated[str, Field(description='Words to look for in the title or description, like "jollof" or "AI". Empty for everything.')] = "",
    category: Annotated[str, Field(description='One category, like "Technology", "Music", "Sports" or "Social". Empty for all.')] = "",
    when: Annotated[When, Field(description='"today", "this_week" (the next 7 days), or "upcoming" (everything from now on).')] = "upcoming",
) -> list[dict]:
    """Find events people can attend on Registro, soonest first.

    Use this when the person describes what they want ("a tech meetup this week", "anything
    with music"). Returns a short summary of each match; use get_event_details for the full
    description of one.
    """
    params = {"dateFilter": when}
    if query.strip():
        params["search"] = query.strip()
    if category.strip():
        params["category"] = category.strip()
    events = await call("GET", "/api/events", params=params)
    return [summarize(event) for event in events]


@mcp.tool(title="Upcoming events", annotations=READ)
async def list_upcoming_events(
    days: Annotated[int, Field(ge=1, le=60, description="How many days ahead to look.")] = 7,
    limit: Annotated[int, Field(ge=1, le=50, description="The most events to return.")] = 20,
) -> list[dict]:
    """List what's coming up on Registro in the next few days, soonest first.

    Use this for open questions like "what's happening this weekend?" when the person hasn't
    said what kind of event they want.
    """
    now = datetime.now(timezone.utc)
    params = {"date_from": now.isoformat(), "date_to": (now + timedelta(days=days)).isoformat()}
    events = await call("GET", "/api/events", params=params)
    return [summarize(event) for event in events[:limit]]


@mcp.tool(title="Event details", annotations=READ)
async def get_event_details(
    event_id: Annotated[str, Field(description="The event_id from search_events or list_upcoming_events.")],
) -> dict:
    """Everything about one event: what it is, when, where, and how many spots are left.

    Use this before registering someone, or when they ask what an event is about.
    """
    event = await call("GET", f"/api/events/{event_id}", token=current_token())
    return {**summarize(event), "description": event.get("description"), "status": event.get("status")}


@mcp.tool(title="My registered events", annotations=READ)
async def list_my_events(
    include_past: Annotated[bool, Field(description="Also list events that have already happened.")] = False,
) -> dict:
    """The events the signed-in person is registered for, soonest first.

    Use this for "what am I going to?" or to check whether they're already registered.
    """
    mine = await call("GET", "/api/users/my-events", token=signed_in_token())
    result = {"upcoming": [summarize(item["event"]) for item in mine.get("upcoming", [])]}
    if include_past:
        result["past"] = [summarize(item["event"]) for item in mine.get("past", [])]
    return result


@mcp.tool(
    title="Register for an event",
    annotations=ToolAnnotations(read_only_hint=False, destructive_hint=False, idempotent_hint=True, open_world_hint=False),
)
async def register_for_event(
    event_id: Annotated[str, Field(description="The event_id of the event to register for.")],
) -> dict:
    """Save the signed-in person a spot at an event.

    Only call this after the person has clearly said yes to this specific event. If the event
    is full, has started, or they're already registered, this says so instead.
    """
    result = await call("POST", f"/api/events/{event_id}/register", token=signed_in_token())
    event = result.get("event")
    return {
        "registered": True,
        "event": summarize(event) if event else {"event_id": event_id},
        "message": "You're in. It's on your Registro list at registro.world/me.",
    }


@mcp.tool(
    title="Cancel a registration",
    annotations=ToolAnnotations(read_only_hint=False, destructive_hint=True, idempotent_hint=True, open_world_hint=False),
)
async def cancel_registration(
    event_id: Annotated[str, Field(description="The event_id of the event to give up the spot for.")],
) -> dict:
    """Give up the signed-in person's spot at an event, freeing it for someone else.

    Only call this when the person asks to cancel, and confirm which event first.
    """
    await call("DELETE", f"/api/events/{event_id}/register", token=signed_in_token())
    return {"cancelled": True, "event_id": event_id}


def _allowed_hosts() -> TransportSecuritySettings:
    """Only answer requests addressed to this server's own host (guards against DNS rebinding)."""
    host = urlparse(PUBLIC_URL).netloc
    return TransportSecuritySettings(
        allowed_hosts=[host, "127.0.0.1:*", "localhost:*"],
        allowed_origins=[f"https://{host}", "http://127.0.0.1:*", "http://localhost:*"],
    )


# The hosted server. Stateless, because a serverless host may answer each request from a fresh
# instance; JSON responses, because nothing here streams.
app = mcp.streamable_http_app(
    stateless_http=True,
    json_response=True,
    transport_security=_allowed_hosts() if PUBLIC_URL else None,
)


if __name__ == "__main__":
    mcp.run()
