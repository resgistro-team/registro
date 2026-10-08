BEGIN;

-- Store users. A user can organize events and attend events.
CREATE TABLE public.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    email TEXT NOT NULL CHECK (length(trim(email)) > 0),
    profile_image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate emails, regardless of capitalization.
CREATE UNIQUE INDEX users_email_unique
ON public.users (lower(email));


-- Store event details and connect each event to its organizer.
CREATE TABLE public.events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.users(user_id),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    image TEXT,
    category TEXT,
    location TEXT NOT NULL CHECK (length(trim(location)) > 0),
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    capacity INTEGER CHECK (capacity > 0),
    status TEXT NOT NULL DEFAULT 'Draft'
        CHECK (
            status IN ('Draft', 'Published', 'Cancelled', 'Completed')
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- An event must end after it starts.
    CHECK (end_datetime > start_datetime)
);

CREATE INDEX events_organizer_idx
ON public.events (organizer_id);

CREATE INDEX events_discovery_idx
ON public.events (status, start_datetime);

CREATE INDEX events_category_idx
ON public.events (category);


-- Connect attendees to the events they register for.
CREATE TABLE public.registrations (
    registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL
        REFERENCES public.events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(user_id),
    registration_status TEXT NOT NULL DEFAULT 'Registered'
        CHECK (
            registration_status IN ('Registered', 'Cancelled')
        ),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A user can have only one registration record per event.
    CONSTRAINT registrations_event_user_unique
        UNIQUE (event_id, user_id)
);

CREATE INDEX registrations_user_idx
ON public.registrations (user_id);


-- Keep table access behind the Python backend.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Remove direct browser access when these Supabase roles exist.
DO $$
DECLARE
    browser_role TEXT;
BEGIN
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = browser_role
        ) THEN
            EXECUTE format(
                'REVOKE ALL ON public.users, public.events,
                 public.registrations FROM %I',
                browser_role
            );
        END IF;
    END LOOP;
END $$;

COMMIT;