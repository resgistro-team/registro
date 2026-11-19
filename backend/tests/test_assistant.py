"""Ask Registro: the chat endpoint, with Claude and the MCP server replaced by scripts."""
import json
from types import SimpleNamespace as NS

import pytest

import auth_middleware
import mcp_bridge
from app import create_app
from routes import assistant

EVENT = {"event_id": "e1", "title": "Jollof Wars", "category": "Culture", "starts": "2026-11-21T23:00:00Z",
         "ends": "2026-11-22T02:00:00Z", "location": "McKenny Hall", "spots_left": 150, "going": 0,
         "link": "https://registro.world/events/e1"}
TOOLS = [{"name": "search_events", "description": "Find events", "input_schema": {"type": "object"}}]


class Block(NS):
    def model_dump(self, exclude_none=True):
        return {k: v for k, v in vars(self).items() if v is not None}


def scripted(*turns):
    """A fake Anthropic client that plays back `turns`: (stream events, final content, stop reason)."""
    calls = []
    remaining = list(turns)

    class Stream:
        def __init__(self, events, content, stop_reason):
            self.events, self.content, self.stop_reason = events, content, stop_reason

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def __iter__(self):
            return iter(self.events)

        def get_final_message(self):
            return NS(stop_reason=self.stop_reason, content=self.content)

    def stream(**kwargs):
        calls.append({**kwargs, "messages": list(kwargs["messages"])})
        return Stream(*remaining.pop(0))

    return NS(messages=NS(stream=stream)), calls


def tool_use(name="search_events", inputs=None, id="t1"):
    return Block(type="tool_use", id=id, name=name, input=inputs or {})


def start(block):
    return NS(type="content_block_start", content_block=block)


def text(words):
    return NS(type="content_block_delta", delta=NS(type="text_delta", text=words))


@pytest.fixture
def mcp(monkeypatch):
    """A fake MCP server. Set `.results` to what each tool call returns."""
    fake = NS(tokens=[], calls=[], results=[])
    monkeypatch.setattr(mcp_bridge, "list_tools", lambda token: fake.tokens.append(token) or TOOLS)

    def call_tools(token, calls):
        fake.tokens.append(token)
        fake.calls.extend(calls)
        return [fake.results.pop(0) for _ in calls]

    monkeypatch.setattr(mcp_bridge, "call_tools", call_tools)
    return fake


@pytest.fixture
def api(monkeypatch, mcp):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    def resolve(token):
        if token != "good":
            raise auth_middleware.AuthenticationError("bad")
        return {"user_id": "u1", "name": "Ama"}

    monkeypatch.setattr(auth_middleware, "_resolve_user", resolve)
    return create_app().test_client()


def use(monkeypatch, client):
    monkeypatch.setattr(assistant, "_client", lambda: (client, "claude-opus-5-5"))


def ask(api, messages, token="good"):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return api.post("/api/assistant", json={"messages": messages, "timezone": "America/Detroit"}, headers=headers)


def lines(response):
    return [json.loads(line) for line in response.get_data(as_text=True).splitlines() if line]


def said(out):
    return "".join(e["text"] for e in out if e["type"] == "text")


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


def test_openrouter_key_uses_openrouter(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    client, model = assistant._client()
    assert str(client.base_url).startswith("https://openrouter.ai/api")
    assert model == "anthropic/claude-opus-5.5"


def test_runs_a_tool_then_answers_with_cards(api, monkeypatch, mcp):
    search = tool_use(inputs={"query": "food"})
    client, calls = scripted(
        ([start(search)], [search], "tool_use"),
        ([text("Jollof Wars is "), text("Saturday at 6 PM.")], [Block(type="text", text="...")], "end_turn"),
    )
    use(monkeypatch, client)
    mcp.results = [([json.dumps(EVENT)], False)]

    out = lines(ask(api, [{"role": "user", "content": "anything with food this weekend?"}]))

    assert out[0] == {"type": "tool", "name": "search_events"}
    assert said(out) == "Jollof Wars is Saturday at 6 PM."
    assert out[-2:] == [{"type": "events", "events": [EVENT]}, {"type": "done"}]

    # Tools come from Registro's MCP server and run there as the signed-in person.
    assert calls[0]["tools"] == TOOLS
    assert mcp.calls == [("search_events", {"query": "food"})]
    assert set(mcp.tokens) == {"good"}
    # Claude sees the tool's answer on the next step.
    result = calls[1]["messages"][-1]["content"][0]
    assert result["type"] == "tool_result" and result["tool_use_id"] == "t1" and "Jollof Wars" in result["content"]
    assert "Ama" in calls[0]["system"] and "America/Detroit" in calls[0]["system"]


def test_shows_each_event_once_and_finds_nested_ones(api, monkeypatch, mcp):
    a, b, c = tool_use(id="a"), tool_use("list_my_events", id="b"), tool_use("register_for_event", id="c")
    client, calls = scripted(([], [a, b, c], "tool_use"), ([text("Done.")], [], "end_turn"))
    use(monkeypatch, client)
    mcp.results = [([json.dumps(EVENT)], False), ([json.dumps({"upcoming": [EVENT], "past": []})], False),
                   (["That event is full."], True)]

    out = lines(ask(api, [{"role": "user", "content": "what am I going to?"}]))

    assert [e for e in out if e["type"] == "events"] == [{"type": "events", "events": [EVENT]}]
    assert calls[1]["messages"][-1]["content"][2]["is_error"] is True


def test_refusal_reads_as_a_sentence(api, monkeypatch):
    client, _ = scripted(([], [], "refusal"))
    use(monkeypatch, client)

    out = lines(ask(api, [{"role": "user", "content": "something off-topic"}]))

    assert "events on Registro" in said(out)


def test_stops_after_too_many_steps(api, monkeypatch, mcp):
    loop = tool_use()
    client, calls = scripted(*[([], [loop], "tool_use")] * assistant.MAX_STEPS)
    use(monkeypatch, client)
    mcp.results = [(["[]"], False)] * assistant.MAX_STEPS

    out = lines(ask(api, [{"role": "user", "content": "hi"}]))

    assert len(calls) == assistant.MAX_STEPS
    assert "more steps" in said(out) and out[-1] == {"type": "done"}


def test_api_failure_is_a_friendly_error(api, monkeypatch):
    import anthropic
    import httpx2

    def boom(**kwargs):
        raise anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com"))

    use(monkeypatch, NS(messages=NS(stream=boom)))

    out = lines(ask(api, [{"role": "user", "content": "hi"}]))

    assert out == [{"type": "error", "message": "Couldn't reach the assistant. Check your connection and try again."},
                   {"type": "done"}]


def test_tool_server_failure_is_a_friendly_error(api, monkeypatch):
    def down(token):
        raise ConnectionError("MCP server unreachable")

    monkeypatch.setattr(mcp_bridge, "list_tools", down)
    use(monkeypatch, scripted()[0])

    out = lines(ask(api, [{"role": "user", "content": "hi"}]))

    assert out[0]["type"] == "error" and "tools" in out[0]["message"]


def test_cards_are_the_events_the_answer_mentions(api, monkeypatch, mcp):
    other = {**EVENT, "event_id": "e2", "title": "Pickup Soccer"}
    listing = tool_use("list_upcoming_events")
    client, _ = scripted(([], [listing], "tool_use"), ([text("Try Jollof Wars on Saturday.")], [], "end_turn"))
    use(monkeypatch, client)
    mcp.results = [([json.dumps(EVENT), json.dumps(other)], False)]

    out = lines(ask(api, [{"role": "user", "content": "anything with food?"}]))

    assert [e for e in out if e["type"] == "events"] == [{"type": "events", "events": [EVENT]}]
