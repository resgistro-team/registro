"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { explain, type ApiError } from "@/lib/api";
import {
  availability,
  hasStarted,
  type MyEvents,
  type Profile,
  type RegistroEvent,
} from "@/lib/events";
import { refreshMyPlans } from "@/lib/my-plans";
import { useAuthedRequest, useViewer } from "@/lib/use-viewer";

type Relation = "checking" | "none" | "going" | "host";

/**
 * The event page's one decision. Every state says what is true and offers one next step:
 * sign in, register, you're going (with a quiet way out), it's full, it started, or it's yours.
 */
export function RsvpPanel({
  initial,
  sample,
}: {
  initial: RegistroEvent;
  sample: boolean;
}) {
  const viewer = useViewer();
  const call = useAuthedRequest();
  const [event, setEvent] = useState(initial);
  const [relation, setRelation] = useState<Relation>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => {
    if (viewer.status !== "signed-in" || sample) return;
    let live = true;
    Promise.all([
      call<{ user: Profile }>("/api/auth/me"),
      call<MyEvents>("/api/users/my-events"),
    ])
      .then(([me, mine]) => {
        if (!live) return;
        if (me.user.user_id === event.organizer_id) return setRelation("host");
        const going = [...mine.upcoming, ...mine.past].some(
          (item) =>
            item.event.event_id === event.event_id &&
            item.registration.registration_status === "Registered",
        );
        setRelation(going ? "going" : "none");
      })
      .catch(() => live && setRelation("none"));
    return () => {
      live = false;
    };
  }, [viewer.status, sample, call, event.event_id, event.organizer_id]);

  async function act(method: "POST" | "DELETE") {
    setPending(true);
    setError(null);
    try {
      const result = await call<{ event: RegistroEvent | null }>(
        `/api/events/${event.event_id}/register`,
        { method },
      );
      if (result.event) setEvent(result.event);
      setRelation(method === "POST" ? "going" : "none");
      setJustJoined(method === "POST");
      setConfirmingCancel(false);
      refreshMyPlans();
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === "ALREADY_REGISTERED") setRelation("going");
      setError(explain(err));
    } finally {
      setPending(false);
    }
  }

  const started = hasStarted(event);
  const space = availability(event);
  const full = space?.tone === "full";
  const signedOut = viewer.status === "signed-out";

  const primary =
    "ticket flex w-full items-center justify-center gap-2.5 bg-paper px-6 py-3.5 text-[0.98rem] font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

  let body;
  if (sample) {
    body = (
      <>
        <button type="button" disabled className={primary}>
          Register
        </button>
        <p className="text-sm text-muted">
          This is a sample event. Registration opens once the API is connected.
        </p>
      </>
    );
  } else if (
    viewer.status === "loading" ||
    (viewer.status === "signed-in" && relation === "checking")
  ) {
    body = (
      <div
        className="h-[3.25rem] rounded-full bg-paper/10"
        aria-hidden="true"
      />
    );
  } else if (relation === "host") {
    body = (
      <>
        <p className="text-[0.98rem] text-paper/85">
          You&apos;re hosting this.
        </p>
        <Link href={`/hosting/${event.event_id}`} className={primary}>
          Manage event
        </Link>
      </>
    );
  } else if (relation === "going") {
    body = (
      <>
        <div className="flex items-center gap-3.5" role="status">
          {justJoined ? (
            <svg
              viewBox="0 0 28 28"
              className="joined-check size-11 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="14" cy="14" r="12" />
              <path d="M9 14.5l3.3 3.3L19 11" />
            </svg>
          ) : null}
          <div className="flex flex-col gap-1">
            <p className="font-display text-2xl font-semibold tracking-tight">
              You&apos;re going.
            </p>
            <p className="text-sm text-paper/70">
              {justJoined ? "Saved to " : "It's in "}
              <Link
                href="/me"
                className="font-semibold text-paper underline-offset-4 hover:underline"
              >
                My events
              </Link>
              .
            </p>
          </div>
        </div>
        {started ? null : confirmingCancel ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-sm text-paper/85">
              Give up your spot? Someone else can take it.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => act("DELETE")}
                className="rounded-full bg-paper/10 px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-paper/20 disabled:opacity-50"
              >
                {pending ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-paper/70 hover:text-paper"
              >
                Keep my spot
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="self-start text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-paper hover:underline"
          >
            Can&apos;t make it?
          </button>
        )}
      </>
    );
  } else if (started) {
    body = (
      <button type="button" disabled className={primary}>
        Already started
      </button>
    );
  } else if (full) {
    body = (
      <button type="button" disabled className={primary}>
        Full
      </button>
    );
  } else if (signedOut) {
    body = (
      <>
        <Link
          href={`/signin?next=${encodeURIComponent(`/events/${event.event_id}`)}`}
          className={primary}
        >
          Sign in to register
        </Link>
        <p className="text-sm text-muted">
          New here?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(`/events/${event.event_id}`)}`}
            className="font-semibold text-paper underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </>
    );
  } else {
    body = (
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => act("POST")}
        className={primary}
      >
        {pending ? (
          <>
            <span className="auth-spinner" aria-hidden="true" />
            Saving your spot
          </>
        ) : (
          "Register"
        )}
      </button>
    );
  }

  return (
    <aside
      className={`flex flex-col gap-5 edge edge-glass rounded-3xl p-6 backdrop-blur-sm sm:p-7 ${justJoined ? "joined-glow" : ""}`}
    >
      <div className="flex flex-col gap-3">
        {/* Lead with the number that helps the decision. Before anyone is in, that's the room left,
            not a zero: "0 going" reads as "nobody wants this" before the event has had a chance. */}
        {event.registration_count > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
                {event.registration_count}{" "}
                <span className="text-lg font-medium text-paper/70">going</span>
              </p>
              {space ? (
                <p
                  className={`text-sm font-semibold ${space.tone === "low" ? "text-ember" : "text-paper"}`}
                >
                  {space.label}
                </p>
              ) : event.remaining_capacity !== null ? (
                <p className="text-sm text-muted tabular-nums">
                  {event.remaining_capacity} left
                </p>
              ) : null}
            </div>
            {event.capacity !== null ? (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-paper/10"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full ${space ? "bg-ember" : "bg-paper/70"}`}
                  style={{
                    width: `${Math.min(100, (event.registration_count / Math.max(1, event.capacity)) * 100)}%`,
                  }}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
              {event.capacity === null ? (
                "Open to all"
              ) : (
                <>
                  {event.capacity}{" "}
                  <span className="text-lg font-medium text-paper/70">
                    spots
                  </span>
                </>
              )}
            </p>
            {relation !== "none" ? null : (
              <p className="text-sm text-muted">
                Nobody&apos;s in yet. You could be first.
              </p>
            )}
          </div>
        )}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-paper"
        >
          {error}
        </p>
      ) : null}
      {body}
    </aside>
  );
}
