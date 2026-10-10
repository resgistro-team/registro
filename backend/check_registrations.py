from data.repository import DataError, register_user

# IDs from our sample data.
workshop_id = "20000000-0000-4000-8000-000000000001"
full_event_id = "20000000-0000-4000-8000-000000000002"
attendee_id = "10000000-0000-4000-8000-000000000002"
second_attendee_id = "10000000-0000-4000-8000-000000000003"


def check_rejection(label, event_id, user_id, expected_code):
    """Check that registration fails for the expected reason."""
    try:
        register_user(event_id, user_id)
    except DataError as error:
        if error.code == expected_code:
            print(f"PASS: {label}")
        else:
            raise AssertionError(f"{label}: unexpected error: {error}") from error
    else:
        raise AssertionError(f"{label}: registration unexpectedly succeeded.")


# This attendee is already registered for the workshop.
check_rejection(
    "Duplicate registration blocked",
    workshop_id,
    attendee_id,
    "ALREADY_REGISTERED",
)

# The full event already has its one available spot occupied.
check_rejection(
    "Full event registration blocked",
    full_event_id,
    second_attendee_id,
    "EVENT_FULL",
)
