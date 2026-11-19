"""The hosted server over HTTP: sign-in is required, and the token reaches the API as the person."""
import importlib

import httpx
import pytest
from starlette.testclient import TestClient

import auth
import registro_api
import server

PUBLIC = "https://mcp.example.test/mcp"
SUPABASE = "https://project.supabase.co"
ACCEPT = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


@pytest.fixture
def hosted(monkeypatch):
    """The server as configured for hosting, with fake Supabase and Registro behind it."""
    monkeypatch.setenv("MCP_PUBLIC_URL", PUBLIC)
    monkeypatch.setenv("SUPABASE_URL", SUPABASE)
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "publishable")
    monkeypatch.delenv("REGISTRO_ACCESS_TOKEN", raising=False)
    importlib.reload(auth)
    hosted_server = importlib.reload(server)
    auth._checked.clear()

    def supabase(request: httpx.Request):
        if request.headers.get("Authorization") == "Bearer good-token":
            return httpx.Response(200, json={"id": "user-1", "email": "ama@example.com"})
        return httpx.Response(401, json={"msg": "invalid JWT"})

    api_calls = []

    def api(request: httpx.Request):
        api_calls.append(request)
        return httpx.Response(200, json={"total": 0, "upcoming": [], "past": []})

    monkeypatch.setattr(auth, "transport", httpx.MockTransport(supabase))
    monkeypatch.setattr(registro_api, "transport", httpx.MockTransport(api))
    with TestClient(hosted_server.app, base_url="https://mcp.example.test") as client:
        yield client, api_calls

    # Put the local (no sign-in) server back for the other tests.
    for name in ("MCP_PUBLIC_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"):
        monkeypatch.delenv(name, raising=False)
    importlib.reload(auth)
    importlib.reload(server)


def rpc(method, params=None, id=1):
    return {"jsonrpc": "2.0", "id": id, "method": method, "params": params or {}}


INIT = rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}})


def test_tells_assistants_where_to_sign_in(hosted):
    client, _ = hosted
    metadata = client.get("/.well-known/oauth-protected-resource/mcp").json()
    assert metadata["resource"] == PUBLIC
    assert metadata["authorization_servers"] == [f"{SUPABASE}/auth/v1"]


def test_refuses_calls_without_a_token(hosted):
    client, _ = hosted
    response = client.post("/mcp", json=INIT, headers=ACCEPT)
    assert response.status_code == 401
    assert "oauth-protected-resource" in response.headers["www-authenticate"]


def test_refuses_a_token_supabase_rejects(hosted):
    client, _ = hosted
    response = client.post("/mcp", json=INIT, headers={**ACCEPT, "Authorization": "Bearer forged"})
    assert response.status_code == 401


def test_a_signed_in_call_reaches_the_api_as_that_person(hosted):
    client, api_calls = hosted
    headers = {**ACCEPT, "Authorization": "Bearer good-token"}
    assert client.post("/mcp", json=INIT, headers=headers).status_code == 200
    response = client.post(
        "/mcp",
        json=rpc("tools/call", {"name": "list_my_events", "arguments": {}}, id=2),
        headers={**headers, "MCP-Protocol-Version": "2025-06-18"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["result"]["isError"] is False
    assert api_calls[-1].url.path == "/api/users/my-events"
    assert api_calls[-1].headers["Authorization"] == "Bearer good-token"


def test_ignores_requests_for_another_host(hosted):
    client, _ = hosted
    response = client.post("/mcp", json=INIT, headers={**ACCEPT, "Authorization": "Bearer good-token", "Host": "evil.example"})
    assert response.status_code in (400, 403, 421)
