"""Ask Registro: the chat endpoint, with Claude replaced by a scripted stream."""
import json
from types import SimpleNamespace as NS

import pytest

import auth_middleware
from app import create_app
from routes import assistant

EVENT = {"event_id": "e1", "title": "Jollof Wars", "category": "Culture", "starts": "2026-11-21T23:00:00Z",
         "ends": "2026-11-22T02:00:00Z", "location": "McKenny Hall", "spots_left": 150, "going": 0,
         "link": "https://registro.world/events/e1"}


def tool_result(payload, is_error=False):
    return NS(type="mcp_tool_result", is_error=is_error, content=[NS(type="text", text=json.dumps(payload))])


def scripted(*turns):
    """A fake Anthropic client whose stream plays back `turns`: (events, stop_reason) per request."""
    calls = []
    remaining = list(turns)

    class Stream:
        def __init__(self, events, stop_reason):
            self.events, self.stop_reason = events, stop_reason

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def __iter__(self):
            return iter(self.events)

        def get_final_message(self):
            return NS(stop_reason=self.stop_reason, content=[])

    def stream(**kwargs):
        calls.append(kwargs)
        events, stop_reason = remaining.pop(0)
        return Stream(events, stop_reason)

    return NS(beta=NS(messages=NS(stream=stream))), calls


def start(block):
    return NS(type="content_block_start", content_block=block)


def text(words):
    return NS(type="content_block_delta", delta=NS(type="text_delta", text=words))


def stop(block=None):
    return NS(type="content_block_stop", content_block=block)


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(auth_middleware, "_resolve_user",
                        lambda token: {"user_id": "u1", "name": "Ama"} if token == "good" else (_ for _ in ()).throw(
                            auth_middleware.AuthenticationError("bad")))
    return create_app().test_client()


def ask(api, messages, token="good"):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return api.post("/api/assistant", json={"messages": messages, "timezone": "America/Detroit"}, headers=headers)


def lines(response):
    return [json.loads(line) for line in response.get_data(as_text=True).splitlines() if line]


def test_needs_sign_in(api):
    assert ask(api, [{"role": "user", "content": "hi"}], token=None).status_code == 401
    assert ask(api, [{"role": "user", "content": "hi"}], token="forged").status_code == 401


@pytest.mark.parametrize("messages", [
    [],
    [{"role": "assistant", "content": "hi"}],
    [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
    [{"role": "user", "content": "   "}],
    [{"role": "user", "content": "x" * 2001}],
])
def test_rejects_malformed_conversations(api, messages):
    response = ask(api, messages)
    assert response.status_code == 400
    assert response.get_json()["code"] == "INVALID_INPUT"


def test_off_without_a_key(api, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    response = ask(api, [{"role": "user", "content": "hi"}])
    assert response.status_code == 503
    assert response.get_json()["code"] == "ASSISTANT_OFF"


def test_streams_words_tools_and_event_cards(api, monkeypatch):
    client, calls = scripted(([
        start(NS(type="mcp_tool_use", name="search_events")),
        stop(),
        stop(tool_result([EVENT])),
        text("Jollof Wars is "),
        text("Saturday at 6 PM."),
    ], "end_turn"))
    monkeypatch.setattr(assistant, "_client", lambda: client)

    out = lines(ask(api, [{"role": "user", "content": "anything with food this weekend?"}]))

    assert out[0] == {"type": "tool", "name": "search_events"}
    assert out[1] == {"type": "events", "events": [EVENT]}
    assert "".join(e["text"] for e in out if e["type"] == "text") == "Jollof Wars is Saturday at 6 PM."
    assert out[-1] == {"type": "done"}

    # Claude reaches Registro's tools as the signed-in person, through the MCP connector.
    request = calls[0]
    assert request["mcp_servers"][0]["authorization_token"] == "good"
    assert request["tools"] == [{"type": "mcp_toolset", "mcp_server_name": "registro"}]
    assert "mcp-client-2025-11-20" in request["betas"]
    assert "Ama" in request["system"] and "America/Detroit" in request["system"]


def test_shows_each_event_once_and_finds_nested_ones(api, monkeypatch):
    mine = {"upcoming": [EVENT], "past": []}
    client, _ = scripted(([stop(tool_result([EVENT])), stop(tool_result(mine)),
                           stop(tool_result({"error": "x"}, is_error=True))], "end_turn"))
    monkeypatch.setattr(assistant, "_client", lambda: client)

    out = lines(ask(api, [{"role": "user", "content": "what am I going to?"}]))

    assert [e for e in out if e["type"] == "events"] == [{"type": "events", "events": [EVENT]}]


def test_carries_on_after_a_paused_turn(api, monkeypatch):
    client, calls = scripted(([text("Looking")], "pause_turn"), ([text(" done.")], "end_turn"))
    monkeypatch.setattr(assistant, "_client", lambda: client)

    out = lines(ask(api, [{"role": "user", "content": "hi"}]))

    assert "".join(e["text"] for e in out if e["type"] == "text") == "Looking done."
    assert len(calls) == 2 and calls[1]["messages"][-1]["role"] == "assistant"


def test_refusal_reads_as_a_sentence(api, monkeypatch):
    client, _ = scripted(([], "refusal"))
    monkeypatch.setattr(assistant, "_client", lambda: client)

    out = lines(ask(api, [{"role": "user", "content": "something off-topic"}]))

    assert any(e["type"] == "text" and "events on Registro" in e["text"] for e in out)


def test_api_failure_is_a_friendly_error(api, monkeypatch):
    import anthropic
    import httpx2

    def boom(**kwargs):
        raise anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com"))

    monkeypatch.setattr(assistant, "_client", lambda: NS(beta=NS(messages=NS(stream=boom))))

    out = lines(ask(api, [{"role": "user", "content": "hi"}]))

    assert out == [{"type": "error", "message": "Couldn't reach the assistant. Check your connection and try again."},
                   {"type": "done"}]
