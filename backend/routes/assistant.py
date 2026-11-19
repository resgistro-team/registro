"""Ask Registro: a chat that finds events and registers people, in plain language.

Claude does the talking. Its tools are Registro's own MCP server (registro_mcp/), which this route
calls as the signed-in person (see mcp_bridge.py). So the assistant can do exactly what the person
could do on the site, under the same rules, and nothing about events is duplicated here.

Claude is reached with the Anthropic SDK, either directly (ANTHROPIC_API_KEY) or through
OpenRouter's Anthropic-compatible endpoint (OPENROUTER_API_KEY).

The reply streams back as newline-delimited JSON, one event per line:
    {"type": "text", "text": "..."}       words of the answer, as they arrive
    {"type": "tool", "name": "..."}       Claude started using a tool (the UI shows what it's doing)
    {"type": "events", "events": [...]}   after the answer: the events it mentions, shown as cards
    {"type": "error", "message": "..."}   something went wrong; the message is safe to show
    {"type": "done"}
"""
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, Response, g, jsonify, request, stream_with_context

import mcp_bridge
from auth_middleware import require_auth

assistant_bp = Blueprint("assistant", __name__)

OPENROUTER_URL = "https://openrouter.ai/api"
# Steps of tool use in one answer: search, read details, register, and a little room to spare.
MAX_STEPS = 8

MAX_TURNS = 30
MAX_CHARS = 2000

SYSTEM = """You are Ask Registro, the assistant on registro.world. Registro is where people find \
events and save their spot: concerts, meetups, workshops, games, socials.

You're talking with {name}, who is signed in. Right now it is {now} in their time zone ({tz}).

Use the Registro tools to answer; never invent events, times or places. Keyword search only \
matches words in titles and descriptions, so for broad asks ("food", "something fun", "music") also \
look at what's upcoming and judge from each event's description.

Don't think out loud or describe your plan: the person only wants the answer. Keep replies short \
and warm: a sentence or two, then the events. The site shows each event you found as a card, so don't \
repeat every detail; mention titles and when they are. Say times in the person's time zone, like \
"Friday at 6:30 PM". Write plain text without markdown: no headings, tables, bullets or asterisks.

Before registering or cancelling, confirm the exact event (title and time) unless the person \
already clearly named it and asked you to do it. If something can't be done (the event is full, \
already started, they're already going), say so plainly and suggest something close."""

# What the UI says while each tool runs.
TOOL_NAMES = {"search_events", "list_upcoming_events", "get_event_details", "list_my_events",
              "register_for_event", "cancel_registration"}


def _configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENROUTER_API_KEY"))


def _client():
    """The Anthropic SDK client and the model name to use with it."""
    # Imported here so the rest of the API runs even where the SDK isn't installed.
    import anthropic

    if os.environ.get("ANTHROPIC_API_KEY"):
        return anthropic.Anthropic(), "claude-opus-5-5"
    client = anthropic.Anthropic(base_url=OPENROUTER_URL, auth_token=os.environ["OPENROUTER_API_KEY"], api_key=None)
    return client, "anthropic/claude-opus-5.5"


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


def events_in(texts: list[str]) -> list[dict]:
    """Events inside one tool result, in the summary shape registro_mcp returns."""
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

    for text in texts:
        try:
            collect(json.loads(text))
        except ValueError:
            continue
    return found


def _cards(found: dict[str, dict], answer: str) -> list[dict]:
    """The events to show under the answer: the ones it talks about, or else what it found."""
    text = answer.lower()
    mentioned = [event for event in found.values() if event["title"].lower() in text]
    return (mentioned or list(found.values()))[:8]


def stream_reply(client, model: str, *, system: str, messages: list[dict], token: str):
    """Run Claude with Registro's tools, step by step, translating everything into the UI's events."""
    tools = mcp_bridge.list_tools(token)
    found: dict[str, dict] = {}
    said: list[str] = []
    conversation = list(messages)
    # Words from an earlier step end where the next step's begin; keep them apart.
    gap = False

    for _ in range(MAX_STEPS):
        with client.messages.stream(
            model=model,
            max_tokens=16000,
            output_config={"effort": "low"},
            system=system,
            messages=conversation,
            tools=tools,
        ) as stream:
            for event in stream:
                if event.type == "content_block_start" and event.content_block.type == "tool_use":
                    name = event.content_block.name
                    yield _line({"type": "tool", "name": name if name in TOOL_NAMES else "other"})
                elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                    if gap:
                        yield _line({"type": "text", "text": "\n\n"})
                        gap = False
                    said.append(event.delta.text)
                    yield _line({"type": "text", "text": event.delta.text})
            final = stream.get_final_message()
        gap = gap or any(block.type == "text" and block.text.strip() for block in final.content)

        if final.stop_reason == "refusal":
            yield _line({"type": "text", "text": "I can't help with that one. Ask me about events on Registro."})
            return
        if final.stop_reason != "tool_use":
            cards = _cards(found, "".join(said))
            if cards:
                yield _line({"type": "events", "events": cards})
            return

        calls = [block for block in final.content if block.type == "tool_use"]
        results = mcp_bridge.call_tools(token, [(block.name, block.input) for block in calls])
        tool_results = []
        for block, (texts, failed) in zip(calls, results):
            if not failed:
                for event in events_in(texts):
                    found.setdefault(event["event_id"], event)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": "\n".join(texts) or "(no result)",
                "is_error": failed,
            })
        conversation = conversation + [
            {"role": "assistant", "content": [block.model_dump(exclude_none=True) for block in final.content]},
            {"role": "user", "content": tool_results},
        ]

    yield _line({"type": "text", "text": "\n\nThat took more steps than I expected. Try asking a little more specifically."})


@assistant_bp.route("", methods=["POST"])
@require_auth
def ask():
    messages, problem = _validate(request.get_json(silent=True))
    if problem:
        return jsonify({"code": "INVALID_INPUT", "error": {"code": "INVALID_INPUT", "message": problem},
                        "message": problem}), 400
    if not _configured():
        message = "Ask Registro isn't switched on yet."
        return jsonify({"code": "ASSISTANT_OFF", "error": {"code": "ASSISTANT_OFF", "message": message},
                        "message": message}), 503

    token = request.headers["Authorization"].split(" ", 1)[1].strip()
    system = _system_prompt((request.get_json(silent=True) or {}).get("timezone"), g.user)
    client, model = _client()

    def generate():
        import anthropic

        try:
            yield from stream_reply(client, model, system=system, messages=messages, token=token)
        except anthropic.RateLimitError:
            yield _line({"type": "error", "message": "Lots of people are asking right now. Try again in a moment."})
        except anthropic.APIStatusError as error:
            print(f"assistant: Claude API {error.status_code}: {error.message}")
            yield _line({"type": "error", "message": "Something went wrong on my side. Try again."})
        except anthropic.APIConnectionError:
            yield _line({"type": "error", "message": "Couldn't reach the assistant. Check your connection and try again."})
        except Exception as error:  # The MCP server, most likely. Never leave the panel hanging.
            print(f"assistant: {type(error).__name__}: {error}")
            yield _line({"type": "error", "message": "Couldn't reach Registro's tools just now. Try again."})
        yield _line({"type": "done"})

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
