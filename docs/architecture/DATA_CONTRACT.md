# Registro Data Contract

Owner: Mohamed

## Event list

The Python function `data.repository.list_events()` returns upcoming
published events, ordered by start time.

Use `data.json_helpers.json_ready()` to convert the results into
JSON-compatible values.

See `example-events.json` for sample output.

| Field | JSON type | Meaning |
|---|---|---|
| event_id | string | Unique event ID (UUID) |
| organizer_id | string | Organizer's user ID (UUID) |
| title | string | Event title |
| description | string | Event description |
| image | string or null | Event image reference, if provided |
| category | string or null | Event category |
| location | string | Event location |
| start_datetime | string | Start date and time in UTC |
| end_datetime | string | End date and time in UTC |
| capacity | integer or null | Maximum registrations; null means unlimited |
| status | string | Event status; Published for this list |
| created_at | string | Creation date and time in UTC |
| organizer_name | string | Organizer's display name |
| registration_count | integer | Number of active registrations |
| remaining_capacity | integer or null | Available spots; null means unlimited |

## Format rules

- Dates use ISO 8601 format with Z indicating UTC.
- IDs are UUID strings.
- Missing optional values appear as null.
- An empty event list is [].
- Only registrations with status Registered count toward capacity.
- A remaining_capacity of 0 means the event is full.
- Draft, Cancelled, and Completed events are excluded from this list.
- Events that have already started are excluded from this list.

## Team integration

- Python connects to PostgreSQL using DATABASE_URL from backend/.env.
- Keep database credentials in the backend.
- React should receive event JSON through the backend API.
- The event query and JSON conversion are implemented.
- The HTTP API endpoint still needs to be connected by the API team.
- register_user(event_id, user_id) creates registrations and checks capacity.
- Duplicate-registration and full-event rejection checks have passed.
- A concurrent registration check passed: two attendees competed for one spot, and exactly one registration was saved.
- The API must supply the authenticated user's verified ID.
- All registration creation must use register_user() for capacity protection.