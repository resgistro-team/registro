BEGIN;

-- Add sample users.
INSERT INTO public.users (user_id, name, email)
VALUES
(
    '10000000-0000-4000-8000-000000000001',
    'Demo Organizer',
    'organizer@example.com'
),
(
    '10000000-0000-4000-8000-000000000002',
    'Demo Attendee',
    'attendee@example.com'
),
(
    '10000000-0000-4000-8000-000000000003',
    'Second Attendee',
    'second@example.com'
)
ON CONFLICT DO NOTHING;


-- Add sample events with future dates.
INSERT INTO public.events (
    event_id,
    organizer_id,
    title,
    description,
    category,
    location,
    start_datetime,
    end_datetime,
    capacity,
    status
)
VALUES
(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Campus Coding Workshop',
    'Practice Python with other students.',
    'Technology',
    'University Center, Room 201',
    now() + interval '7 days',
    now() + interval '7 days 2 hours',
    30,
    'Published'
),
(
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Full Event Demo',
    'Test the no-spaces-left message.',
    'Workshop',
    'Room 202',
    now() + interval '8 days',
    now() + interval '8 days 1 hour',
    1,
    'Published'
),
(
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Draft Event Demo',
    'This must not appear in public discovery.',
    'Technology',
    'Room 203',
    now() + interval '9 days',
    now() + interval '9 days 1 hour',
    20,
    'Draft'
)
ON CONFLICT DO NOTHING;


-- Register the demo attendee for the two published events.
INSERT INTO public.registrations (
    registration_id,
    event_id,
    user_id
)
VALUES
(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002'
),
(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002'
)
ON CONFLICT DO NOTHING;

COMMIT;