# Registro

Registro is where people find events and save their spot: concerts, workshops, games, meetups. Hosts publish an event and see who's coming. Attendees find something to do, register in one tap, and keep track of what's next.

**Live:** https://registro.world

## Status

The MVP is complete and live. Every step of the event lifecycle works on the live site:

1. A host creates an event.
2. The event is published and appears on the events wall.
3. An attendee opens the event page.
4. The attendee registers, and can cancel.
5. The host sees who registered.
6. The event appears under the attendee's My events.

## What you can do

**As an attendee**
- Browse upcoming events, search them, and filter by day and category.
- Open an event to see when, where, what it is, and how many spots are left.
- Register or cancel. Full and already-started events say so instead of offering a button.
- See what you're going to, and what you went to, under My events. The home page shows your next event and how soon it starts.
- Ask Registro: a chat on the site that finds events in plain language ("anything with food this weekend?") and can register you after you confirm.

**As a host**
- Create, edit, publish and cancel events, with a cover image.
- See who registered for each event.

**From an AI assistant**
- Connect Registro to Claude or another assistant that supports MCP servers. You can then search, check details, see your plans, and register from the chat, signed in as yourself. See [registro_mcp/](registro_mcp/).

## Repository

| Path | What it is |
|---|---|
| [frontend/](frontend/) | The website. Setup in [frontend/README.md](frontend/README.md). |
| [backend/](backend/) | The API and data layer. Setup in [backend/README.md](backend/README.md). |
| [registro_mcp/](registro_mcp/) | The MCP server that lets AI assistants use Registro. Setup in [registro_mcp/README.md](registro_mcp/README.md), design in [registro_mcp/ARCHITECTURE.md](registro_mcp/ARCHITECTURE.md). |
| [docs/product/](docs/product/) | The product spec. |
| [docs/architecture/](docs/architecture/) | The data contract between the API and the website. |
| [docs/design/](docs/design/) | Logo concepts and the before-and-after record of the app redesign. |

## Live services

| Service | URL |
|---|---|
| Website | https://registro.world |
| API | https://registro-api-eight.vercel.app |
| MCP server | https://registro-mcp.vercel.app/mcp |

Merging to `main` does not deploy. Each service is deployed from its own folder.

## Demo events

`backend/seed_demo_events.py` adds ten sample events dated from the day you run it, posted by demo hosts. Nobody is registered to them at the start. To refresh them before a demo, run it from `backend/`:

```bash
python seed_demo_events.py --remove   # delete the old demo events and hosts
python seed_demo_events.py            # add fresh ones
```

It only touches events owned by `demo+...@example.com` hosts.

## Team

| Person | Area |
|---|---|
| Kwabena Adu Adjei | Website and design, Ask Registro, and the MCP server (individual honors work) |
| Mohamed | Data layer and database |
| Ahmed | Host (organizer) API |
| Victor | Attendee API |
| Hamzah | Testing and QA |

## Working on Registro

- Keep `main` stable.
- Build each task on its own branch, for example `feature/event-search` or `fix/registration-validation`.
- Open a pull request and let the tests pass before merging.
- Keep each pull request to one feature or fix.

More in [CONTRIBUTING.md](CONTRIBUTING.md).
