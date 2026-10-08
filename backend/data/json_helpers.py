from datetime import datetime, timezone
from uuid import UUID


def json_ready(value):
    """Convert database values into types that JSON supports."""
    if isinstance(value, dict):
        return {key: json_ready(item) for key, item in value.items()}

    if isinstance(value, list):
        return [json_ready(item) for item in value]

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    return value