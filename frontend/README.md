# Registro frontend

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, three.js.

## Run it

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. `npm run build` makes a production build, `npm run lint` checks the code.

Copy `.env.example` to `.env.local` and fill it in. With every value empty the site still runs: sample events, and sign-in in preview mode.

The live site uses the hosted API at https://registro-api-eight.vercel.app (set as `NEXT_PUBLIC_API_URL` in Vercel). To use real data locally, run the API too (`backend/`, see its README) and set `NEXT_PUBLIC_API_URL`. On a Mac, port 5000 is taken by AirPlay, so run the API with `PORT=5050` and point the frontend at `http://localhost:5050`.

This Next.js version has breaking changes from older ones. Read `AGENTS.md` before writing code.

## What is here

| Path | What it is |
|---|---|
| `src/app/page.tsx` | The landing page: hero, then upcoming events with search and category filters. |
| `src/app/(app)/events/[id]` | One event: details, and register or cancel. |
| `src/app/(app)/me` | My events: what you're going to, and what you went to. |
| `src/app/(app)/hosting` | Hosting: your events, a form to create or edit one, publish or cancel it, and who's going. |
| `src/lib/api.ts` | The only file that calls the API. Error codes become plain English here. |
| `src/lib/campus-time.ts` | Reads the event form's times as campus (Eastern) time, whatever the browser's zone. |
| `src/components/hero/` | The hero. `DescentHero.tsx` is the React side, `descent-scene.ts` is the three.js scene, `Typewriter.tsx` cycles the slogan lines. |
| `src/components/UpcomingEvents.tsx` | Event list. Reads the API, or sample rows when no API is set. |
| `src/lib/events.ts` | Event types, copied field for field from `docs/architecture/DATA_CONTRACT.md`. |
| `src/lib/mock-events.ts` | Sample rows, used only when `NEXT_PUBLIC_API_URL` is empty. |
| `public/hero/` | NASA imagery and the star catalogue. See `CREDITS.md` there for sources and licence terms. |

## The hero

The camera dives from orbit to Eastern Michigan University. The city lights then lift off the ground and form the name, and the name reacts to the pointer.

- It plays once per browser session. The Replay button in the corner plays it again.
- Scrolling, or pressing a key that scrolls, fast-forwards it.
- With "reduce motion" switched on, the finished frame shows straight away and nothing moves.
- Without WebGL the name is plain text and the page works the same.
- Add `?heroT=3.2` to the URL to hold the dive at that second. Useful for screenshots and tuning.

The timeline, landing spot and sun position are constants at the top of `descent-scene.ts`.

## Accounts (Supabase Auth)

Screens: `/signup`, `/signin`, `/reset` (forgot password) and `/update-password` (where the reset email lands). Email links go through `/auth/confirm`.

**Preview mode.** With no Supabase keys set, the screens work but save nothing, and say so in a badge. Sign-in accepts any email; the password `wrong-password` shows the wrong-password message, and signing up with an email starting `taken@` shows the "already an account" message.

**Email confirmation is off for the prototype.** Supabase's built-in email is rate-limited, and an email that never arrives would break sign-up during the demo. In Supabase, switch off Authentication > Providers > Email > "Confirm email", and sign-up logs people straight in. Turn it back on, with a real email provider, after the demo. Password reset still sends an email, so it is subject to the same limits.

**Going live.** Copy `.env.example` to `.env.local` and fill in the two values from the Supabase dashboard (Project Settings > API). Add the same two to the Vercel project. Then in Supabase, under Authentication > URL Configuration:

- Site URL: the production URL.
- Redirect URLs: `http://localhost:3000/auth/confirm` and `https://<your-domain>/auth/confirm`.

Without those redirect URLs, confirmation and reset emails send people to the wrong place.

**For the backend.** Sign-up stores the person's name as `full_name` in Supabase user metadata. The API should verify the Supabase access token sent with each request, then call `get_or_create_user(email, full_name)` from `data.repository` to get the Registro user ID. Never take a user ID from the request body.

`src/lib/auth.ts` is the only file that talks to Supabase from the browser. `src/proxy.ts` keeps the session fresh on each request.

## Talking to the API

Public pages (the event list and event details) load on the server. Anything tied to a person (registering, My events, hosting) runs in the browser and sends the Supabase access token, which the API verifies before calling `get_or_create_user()`.

`/me` and `/hosting` redirect to sign-in when nobody is signed in (`src/lib/supabase/proxy.ts`). The API enforces access on its own; the redirect only saves a wasted trip.

With no API configured, the event list shows sample rows and registration is switched off, with a note saying so.

Not built yet: the AI assistant, event images, and "Continue with Google".
