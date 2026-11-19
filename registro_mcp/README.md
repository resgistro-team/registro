# Registro MCP server

Lets AI assistants (Claude, ChatGPT, Gemini) use Registro. You can ask "find me a tech event this week and register me" and the assistant does it, signed in as you.

COSC 482W Honors Contract: an individual extension to the Registro team project, by Kwabena Adu Adjei. The design is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Tools

| Tool | What it does | Needs sign-in |
|---|---|---|
| `search_events` | Find events by words, category and time window | no* |
| `list_upcoming_events` | What's on in the next few days | no* |
| `get_event_details` | Everything about one event, including spots left | no* |
| `list_my_events` | The events you're registered for | yes |
| `register_for_event` | Save you a spot | yes |
| `cancel_registration` | Give a spot back | yes |

\* Once hosted, the whole server needs sign-in: an assistant signs in once when you connect Registro, and every tool runs as you.

## Run it locally

```
cd registro_mcp
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/mcp dev server.py          # opens the MCP Inspector in your browser
```

Locally there is no sign-in screen. To try the tools that act as you, put a signed-in user's access token in `REGISTRO_ACCESS_TOKEN` (see `.env.example`).

To use it from Claude Desktop, add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "registro": {
      "command": "/absolute/path/to/registro_mcp/.venv/bin/python",
      "args": ["/absolute/path/to/registro_mcp/server.py"]
    }
  }
}
```

## Test

```
.venv/bin/python -m pytest -q
```

The tests drive the server with a real MCP client against a fake Registro API and a fake Supabase, so they never touch real data. They cover every tool, input validation, error messages, and the hosted sign-in flow over HTTP.

## Host it

The server is meant to run on Vercel, next to the API, as its own project (`registro-mcp`).

1. **Supabase** (dashboard, one time):
   - **Authentication → OAuth Server**: turn it on, set **Authorization Path** to `/oauth/consent`, and allow **dynamic client registration**. Assistants register themselves.
   - **Authentication → URL Configuration**: check that **Site URL** is `https://registro.world`. The consent screen lives at Site URL + `/oauth/consent`.
2. **Vercel**: create the `registro-mcp` project from this folder and set:
   - `MCP_PUBLIC_URL`: the server's own URL, ending in `/mcp`, e.g. `https://registro-mcp.vercel.app/mcp`
   - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: the same values the API uses
   - `REGISTRO_API_URL`: `https://registro-api-eight.vercel.app`

   Then deploy with `vercel deploy --prod`.
3. **Connect an assistant**: in Claude, go to **Settings → Connectors → Add custom connector** and paste the `MCP_PUBLIC_URL`. Claude sends you to registro.world to sign in and press **Allow**.

## Files

- `server.py`: the MCP server and its tools; `app` is the hosted HTTP form
- `auth.py`: checks each sign-in token with Supabase
- `registro_api.py`: calls the Registro API and turns its errors into plain sentences
- `tests/`: tool tests and hosted sign-in tests
- Frontend, outside this folder: the consent screen at `frontend/src/app/(auth)/oauth/`
