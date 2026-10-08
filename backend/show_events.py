import json

from data.json_helpers import json_ready
from data.repository import list_events

# Read the events and convert their values into JSON-compatible types.
events = json_ready(list_events())

# Display formatted JSON.
print(json.dumps(events, indent=2))