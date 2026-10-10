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
- HTTP API endpoints and authentication still need integration by the API team.
- register_user(event_id, user_id) creates registrations and checks capacity.
- Duplicate-registration and full-event rejection checks have passed.
- A concurrent registration check passed: two attendees competed for one spot, and exactly one registration was saved.
- The API must supply the authenticated user's verified ID.
- All registration creation must use register_user() for capacity protection.

## Function contract (updated handoff)

These are module-level functions in `data.repository`; existing `list_events()`
and `register_user(event_id, user_id)` imports remain supported. Functions return
Python dictionaries/lists with UUID and datetime objects. Apply `json_ready()`
once at the API boundary before JSON serialization. Event dictionaries retain
`remaining_capacity` (not `spaces_remaining`). Lists return `[]` when empty.

| Function | Return and behavior |
|---|---|
| `create_event(organizer_id, **fields)` | Full event dictionary; defaults to Draft |
| `update_event(event_id, organizer_id, **fields)` | Full updated event; partial update; owner only |
| `delete_event(event_id, organizer_id)` | `True`; permanently deletes event and its registrations; owner only |
| `list_organizer_events(organizer_id)` | Full event list, all statuses and dates, sorted by start time then ID |
| `get_event(event_id)` | Full Published event, including past events; raises an error if missing/unpublished |
| `list_events()` | Upcoming Published events ordered by start time then ID |
| `search_events(query=None, category=None, date_from=None, date_to=None)` | Same visibility/order as list_events; filters combined with AND |
| `register_user(event_id, user_id)` | Registration dictionary; reactivates an existing Cancelled row |
| `cancel_registration(event_id, user_id)` | Registration dictionary with Cancelled status; repeated cancellation returns the same row |
| `list_user_registrations(user_id)` | Own active/cancelled registrations, including past events, with nested `event` dictionary |
| `list_attendees(event_id, organizer_id)` | Active registrations plus attendee `name` and `email`; owner only |

All user/organizer IDs must be UUIDs from verified authentication, never trusted
from a request body. The API is responsible for authenticating and authorizing
access to user-specific list functions. A profile must already exist in
`public.users`; login/profile provisioning is outside this data layer.
`get_event()` is public; organizers use `list_organizer_events()` to see drafts.
Cancellation is allowed before the event starts regardless of event status.
Hard deletion removes registration history; use `update_event(..., status="Cancelled")`
to preserve it.

## Create-event input (Ahmed)

Call `create_event(authenticated_user_id, **payload)`. The authenticated ID is
passed separately; reject any `organizer_id` included in an untrusted payload.

| Field | Required? | Accepted value / default |
|---|---|---|
| title | Yes | Nonblank string; surrounding whitespace trimmed |
| description | Yes | Nonblank string; surrounding whitespace trimmed |
| location | Yes | Nonblank string; surrounding whitespace trimmed |
| start_datetime | Yes | ISO 8601 string with timezone or aware Python datetime; must be future |
| end_datetime | Yes | ISO 8601 string with timezone or aware Python datetime; must be after start |
| image | No | String or null; default null; this layer does not upload images |
| category | No | String or null; default null |
| capacity | No | Integer 1 through 2147483647 or null; default null means unlimited |
| status | No | Draft (default), Published, Cancelled, or Completed; case-sensitive |

Example JSON request body (use future dates when testing):

```json
{
  "title": "Campus Coding Workshop",
  "description": "Practice Python with other students.",
  "location": "University Center, Room 201",
  "start_datetime": "2027-01-15T18:00:00Z",
  "end_datetime": "2027-01-15T20:00:00Z",
  "category": "Technology",
  "capacity": 30,
  "status": "Published"
}
```

Do not send `event_id`, `organizer_id`, `created_at`, `organizer_name`,
`registration_count`, or `remaining_capacity` as event fields. Unknown fields,
missing required fields, blank required text, invalid types/statuses, naive
datetimes, invalid date order, and zero/negative capacities raise `INVALID_INPUT`.
UUIDs and timestamps are generated by PostgreSQL where appropriate.

Updates accept one or more of the same editable fields. Omitted fields stay
unchanged; null clears only image, category, or capacity. Combined old/new dates
must still have end > start. A supplied new start must be future. Setting status
to Published publishes the event; setting it to Cancelled removes it from public
lookup/discovery. No additional status-transition workflow is enforced yet.
Capacity cannot fall below the count of Registered rows (Cancelled rows do not
count). Capacity may equal the count; null removes the limit.

## Search and registration output (Victor)

`query` matches a literal case-insensitive substring of title, description, or
location; `%` and `_` are literal characters, not wildcards. Category is an exact,
case-sensitive match. Date filters use timezone-aware ISO strings or datetimes:
start >= date_from, start < date_to. Invalid/reversed bounds raise INVALID_INPUT.

Registration dictionaries contain `registration_id`, `event_id`, `user_id`,
`registration_status` (Registered/Cancelled), and `registered_at`. After
`json_ready()`, IDs are strings and timestamps are UTC ISO strings ending in Z.
`list_user_registrations()` adds `event`, with the same fields as the event table
above, and orders by event start time then registration ID. It includes cancelled
registrations so the API/UI can filter them explicitly. It never returns another
user's registrations when passed the verified caller's ID.

## Stable error codes

Catch `DataError` and inspect `.code`; `.message` / `str(error)` are for display.
Suggested HTTP statuses below are guidance for the API layer, not implemented
HTTP routes.

| Code | Meaning | Suggested HTTP status |
|---|---|---|
| EVENT_NOT_FOUND | Event ID does not exist | 404 |
| EVENT_NOT_PUBLISHED | Public detail/registration requested for an unpublished event | 409 (API may use 404 to hide drafts) |
| EVENT_ALREADY_STARTED | Register/cancel requested after start | 409 |
| USER_NOT_FOUND | User profile does not exist | 404 |
| ALREADY_REGISTERED | Active registration already exists | 409 |
| EVENT_FULL | No capacity remains | 409 |
| FORBIDDEN | Caller is not the event organizer | 403 |
| CAPACITY_TOO_SMALL | Proposed limit is below active registrations | 409 |
| REGISTRATION_NOT_FOUND | Caller has no registration to cancel | 404 |
| INVALID_INPUT | Invalid ID, event fields, or search parameters | 400 |

Registration checks run in this order: valid IDs, event existence, Published
status, future start, user existence, duplicate, capacity. Unexpected connection
or database errors are not disguised as business errors; API handlers should log
those privately and return a generic 500/503 response.

```python
from data.repository import DataError, create_event, register_user
from data.json_helpers import json_ready

# Inside an authenticated API handler:
try:
    result = json_ready(register_user(event_id, authenticated_user_id))
except DataError as error:
    error_body = {"error": {"code": error.code, "message": error.message}}
    # Return error_body with the HTTP status selected by the API framework.
```

## Transaction rules

Registration, cancellation, owner updates, and deletion lock the same event row
until commit/rollback. Capacity edits check the active count while holding that
lock. All application writes must follow this protocol: privileged raw SQL can
bypass these application checks. Do not lower capacity or insert/reactivate
registrations directly from API code. Database constraints separately enforce
unique (event_id, user_id), foreign keys, positive capacity, and date order.
