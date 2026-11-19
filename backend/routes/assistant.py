"""Ask Registro: a chat that finds events and registers people, in plain language.

Claude does the talking. The tools it uses are Registro's own MCP server (registro_mcp/), reached
through Anthropic's MCP connector with the person's own sign-in. So the assistant can do exactly
what the person could do on the site, under the same rules, and nothing about events is
duplicated here.

The reply streams back as newline-delimited JSON, one event per line:
    {"type": "text", "text": "..."}       words of the answer, as they arrive
    {"type": "tool", "name": "..."}       Claude started using a tool (the UI shows what it's doing)
    {"type": "events", "events": [...]}   events a tool returned, for the UI to show as cards
    {"type": "error", "message": "..."}   something went wrong; the message is safe to show
    {"type": "done"}
"""
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, Response, g, jsonify, request, stream_with_context

from auth_middleware import require_auth

assistant_bp = Blueprint("assistant", __name__)

MODEL = "claude-opus-5-5"
MCP_URL = os.environ.get("REGISTRO_MCP_URL", "https://registro-mcp.vercel.app/mcp")
BETAS = ["mcp-client-2025-11-20", "server-side-fallback-2026-07-01"]

MAX_TURNS = 30
MAX_CHARS = 2000
# A server tool loop can pause after many steps; this many continuations is plenty for one question.
MAX_CONTINUATIONS = 3

SYSTEM = """You are Ask Registro, the assistant on registro.world. Registro is where people find \
events and save their spot: concerts, meetups, workshops, games, socials.

You're talking with {name}, who is signed in. Right now it is {now} in their time zone ({tz}).

Use the Registro tools to answer; never invent events, times or places. Keep replies short and \
warm: a sentence or two, then the events. The site shows each event you found as a card, so don't \
repeat every detail; mention titles and when they are. Say times in the person's time zone, like \
"Friday at 6:30 PM". Write plain text without markdown: no headings, tables, bullets or asterisks.

Before registering or cancelling, confirm the exact event (title and time) unless the person \
already clearly named it and asked you to do it. If something can't be done (the event is full, \
already started, they're already going), say so plainly and suggest something close."""

# What the UI says while each tool runs.
TOOL_NAMES = {"search_events", "list_upcoming_events", "get_event_details", "list_my_events",
              "register_for_event", "cancel_registration"}


def _client():
    # Imported here so the rest of the API runs even where the SDK isn't installed.
    import anthropic

    return anthropic.Anthropic()


def _line(payload: dict) -> str:
    return json.dumps(payload, separators=(",", ":")) + "\n"


def _validate(body) -> tuple[list[dict] | None, str | None]:
    """The conversation so far, as plain text turns, or why it can't be used."""
    messages = body.get("messages") if isinstance(body, dict) else None
    if not isinstance(messages, list) or not messages:
        return None, "Send the conversation as a list of messages."
    if len(messages) > MAX_TURNS:
        return None, "This conversation is too long. Start a new one."
    clean = []
    for index, message in enumerate(messages):
        role = message.get("role") if isinstance(message, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        expected = "user" if index % 2 == 0 else "assistant"
        if role != expected or not isinstance(content, str) or not content.strip():
            return None, "Messages must alternate, starting and ending with the person."
        if len(content) > MAX_CHARS:
            return None, f"Keep each message under {MAX_CHARS} characters."
        clean.append({"role": role, "content": content.strip()})
    if clean[-1]["role"] != "user":
        return None, "Messages must alternate, starting and ending with the person."
    return clean, None


def _system_prompt(tz_name: str | None, user: dict) -> str:
    try:
        tz = ZoneInfo(tz_name or "America/New_York")
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo("America/New_York")
    now = datetime.now(tz).strftime("%A, %B %-d, %Y, %-I:%M %p")
    name = (user.get("name") or "").strip() or "a Registro member"
    return SYSTEM.format(name=name, now=now, tz=tz.key)


def events_in(result_block) -> list[dict]:
    """Events inside one MCP tool result, in the summary shape registro_mcp returns."""
    found = []

    def collect(value):
        if isinstance(value, dict):
            if "event_id" in value and "title" in value and "starts" in value:
                found.append(value)
            else:
                for inner in value.values():
                    collect(inner)
        elif isinstance(value, list):
            for inner in value:
                collect(inner)

    if getattr(result_block, "is_error", False):
        return []
    content = getattr(result_block, "content", None)
    if isinstance(content, str):
        content = [{"type": "text", "text": content}]
    for part in content or []:
        text = part.get("text") if isinstance(part, dict) else getattr(part, "text", None)
        if not text:
            continue
        try:
            collect(json.loads(text))
        except ValueError:
            continue
    return found


def stream_reply(client, *, system: str, messages: list[dict], token: str):
    """Run Claude with Registro's tools and translate its stream into the UI's events."""
    shown: set[str] = set()
    conversation = list(messages)

    for _ in range(MAX_CONTINUATIONS + 1):
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=16000,
            betas=BETAS,
            fallbacks="default",
            output_config={"effort": "low"},
            system=system,
            messages=conversation,
            mcp_servers=[{"type": "url", "url": MCP_URL, "name": "registro", "authorization_token": token}],
            tools=[{"type": "mcp_toolset", "mcp_server_name": "registro"}],
        ) as stream:
            for event in stream:
                if event.type == "content_block_start" and event.content_block.type == "mcp_tool_use":
                    name = event.content_block.name
                    yield _line({"type": "tool", "name": name if name in TOOL_NAMES else "other"})
                elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield _line({"type": "text", "text": event.delta.text})
                elif event.type == "content_block_stop":
                    block = getattr(event, "content_block", None)
                    if block is not None and block.type == "mcp_tool_result":
                        fresh = [e for e in events_in(block) if e["event_id"] not in shown]
                        shown.update(e["event_id"] for e in fresh)
                        if fresh:
                            yield _line({"type": "events", "events": fresh[:8]})
            final = stream.get_final_message()

        if final.stop_reason == "pause_turn":
            # The tool loop paused mid-answer. Hand back what it has so far and let it carry on.
            conversation = conversation + [
                {"role": "assistant", "content": [block.model_dump(exclude_none=True) for block in final.content]}
            ]
            continue
        if final.stop_reason == "refusal":
            yield _line({"type": "text", "text": "I can't help with that one. Ask me about events on Registro."})
        break


@assistant_bp.route("", methods=["POST"])
@require_auth
def ask():
    messages, problem = _validate(request.get_json(silent=True))
    if problem:
        return jsonify({"code": "INVALID_INPUT", "error": {"code": "INVALID_INPUT", "message": problem},
                        "message": problem}), 400
    if not os.environ.get("ANTHROPIC_API_KEY"):
        message = "Ask Registro isn't switched on yet."
        return jsonify({"code": "ASSISTANT_OFF", "error": {"code": "ASSISTANT_OFF", "message": message},
                        "message": message}), 503

    token = request.headers["Authorization"].split(" ", 1)[1].strip()
    system = _system_prompt((request.get_json(silent=True) or {}).get("timezone"), g.user)
    client = _client()

    def generate():
        import anthropic

        try:
            yield from stream_reply(client, system=system, messages=messages, token=token)
        except anthropic.RateLimitError:
            yield _line({"type": "error", "message": "Lots of people are asking right now. Try again in a moment."})
        except anthropic.APIStatusError as error:
            print(f"assistant: Claude API {error.status_code}: {error.message}")
            yield _line({"type": "error", "message": "Something went wrong on my side. Try again."})
        except anthropic.APIConnectionError:
            yield _line({"type": "error", "message": "Couldn't reach the assistant. Check your connection and try again."})
        yield _line({"type": "done"})

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
