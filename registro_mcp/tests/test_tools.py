"""The tools, driven by a real MCP client in-process, against a fake Registro API."""
import asyncio
import json

import httpx
import pytest
from mcp import Client

import registro_api
import server

EVENT = {
    "event_id": "e1",
    "title": "Jollof Wars",
    "category": "Culture",
    "start_datetime": "2026-12-01T23:00:00Z",
    "end_datetime": "2026-12-02T02:00:00Z",
    "location": "McKenny Hall",
    "capacity": 150,
    "registration_count": 40,
    "description": "Taste every pot, then vote.",
    "status": "Published",
}


@pytest.fixture
def api(monkeypatch):
    """A fake Registro API. Records every request; answers from `routes`."""
    seen, routes = [], {}

    def handle(request: httpx.Request):
        seen.append(request)
        status, body = routes.get((request.method, request.url.path), (404, {"code": "EVENT_NOT_FOUND"}))
        return httpx.Response(status, json=body)

    monkeypatch.setattr(registro_api, "transport", httpx.MockTransport(handle))
    monkeypatch.delenv("REGISTRO_ACCESS_TOKEN", raising=False)
    return seen, routes


def run(tool, args=None):
    async def go():
        async with Client(server.mcp) as client:
            return await client.call_tool(tool, args or {})

    result = asyncio.run(go())
    if result.is_error:
        return True, result.content[0].text
    # Tools return typed data; lists arrive wrapped as {"result": [...]}.
    # Lists arrive as structured data wrapped in {"result": [...]}; dicts as JSON text.
    data = result.structured_content
    if data is None:
        return False, json.loads(result.content[0].text)
    return False, data["result"] if set(data) == {"result"} else data


def test_offers_the_proposals_tools():
    async def go():
        async with Client(server.mcp) as client:
            return (await client.list_tools()).tools

    tools = {t.name: t for t in asyncio.run(go())}
    assert set(tools) == {
        "search_events", "list_upcoming_events", "get_event_details",
        "list_my_events", "register_for_event", "cancel_registration",
    }
    # Assistants use these hints to decide what needs the person's go-ahead.
    assert tools["search_events"].annotations.read_only_hint is True
    assert tools["register_for_event"].annotations.read_only_hint is False
    assert tools["cancel_registration"].annotations.destructive_hint is True


def test_search_passes_filters_and_returns_summaries(api):
    seen, routes = api
    routes[("GET", "/api/events")] = (200, [EVENT])
    failed, events = run("search_events", {"query": " jollof ", "category": "Culture", "when": "this_week"})
    assert not failed
    assert dict(seen[0].url.params) == {"dateFilter": "this_week", "search": "jollof", "category": "Culture"}
    assert events == [{
        "event_id": "e1", "title": "Jollof Wars", "category": "Culture",
        "starts": "2026-12-01T23:00:00Z", "ends": "2026-12-02T02:00:00Z", "location": "McKenny Hall",
        "spots_left": 110, "going": 40, "link": "https://registro.world/events/e1",
    }]


def test_search_refuses_an_unknown_time_window(api):
    failed, message = run("search_events", {"when": "tomorrow"})
    assert failed and "upcoming" in message
    assert api[0] == []  # never reached the API


def test_details_include_the_description(api):
    api[1][("GET", "/api/events/e1")] = (200, EVENT)
    failed, event = run("get_event_details", {"event_id": "e1"})
    assert not failed and event["description"] == "Taste every pot, then vote."


def test_signed_in_tools_ask_for_sign_in_first(api):
    for tool, args in [("list_my_events", {}), ("register_for_event", {"event_id": "e1"}), ("cancel_registration", {"event_id": "e1"})]:
        failed, message = run(tool, args)
        assert failed and "sign in" in message
    assert api[0] == []


def test_register_acts_as_the_signed_in_person(api, monkeypatch):
    monkeypatch.setenv("REGISTRO_ACCESS_TOKEN", "person-token")
    api[1][("POST", "/api/events/e1/register")] = (201, {"event": EVENT})
    failed, result = run("register_for_event", {"event_id": "e1"})
    assert not failed and result["registered"] is True
    assert api[0][0].headers["Authorization"] == "Bearer person-token"


def test_a_full_event_is_explained_not_crashed_on(api, monkeypatch):
    monkeypatch.setenv("REGISTRO_ACCESS_TOKEN", "person-token")
    api[1][("POST", "/api/events/e1/register")] = (409, {"code": "EVENT_FULL", "message": "Event is full"})
    failed, message = run("register_for_event", {"event_id": "e1"})
    assert failed and "full" in message


def test_my_events_hides_the_past_unless_asked(api, monkeypatch):
    monkeypatch.setenv("REGISTRO_ACCESS_TOKEN", "person-token")
    api[1][("GET", "/api/users/my-events")] = (200, {"upcoming": [{"event": EVENT}], "past": [{"event": EVENT}]})
    assert set(run("list_my_events")[1]) == {"upcoming"}
    assert set(run("list_my_events", {"include_past": True})[1]) == {"upcoming", "past"}


def test_an_unreachable_api_gets_a_plain_answer(monkeypatch):
    def down(request):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(registro_api, "transport", httpx.MockTransport(down))
    failed, message = run("list_upcoming_events")
    assert failed and "isn't responding" in message
