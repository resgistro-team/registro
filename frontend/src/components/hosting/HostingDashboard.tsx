"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "@/components/Cover";
import { ListSkeleton } from "@/components/me/MyEventsList";
import { Notice, linkClass, primaryButton } from "@/components/Notice";
import { apiConfigured, explain, needsSignIn } from "@/lib/api";
import { coverFor } from "@/lib/covers";
import { eventDateParts, hasStarted, type RegistroEvent } from "@/lib/events";
import { useAuthedRequest } from "@/lib/use-viewer";
import { StatusLabel } from "./StatusLabel";

type State =
  | { status: "loading" }
  | { status: "failed"; message: string; signedOut: boolean }
  | { status: "ready"; events: RegistroEvent[] };

/** Your events in the order they happen, each with how full it is. Past and cancelled ones sink to the bottom. */
export function HostingDashboard() {
  const call = useAuthedRequest();
  const [state, setState] = useState<State>({ status: "loading" });
  // Bumped by "Try again", which refetches in place instead of reloading the page.
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (!apiConfigured) return;
    let live = true;
    call<RegistroEvent[]>("/api/events/organizer")
      .then((events) => live && setState({ status: "ready", events }))
      .catch(
        (error) =>
          live && setState({ status: "failed", message: explain(error), signedOut: needsSignIn(error) }),
      );
    return () => {
      live = false;
    };
  }, [call, attempt]);

  if (!apiConfigured) {
    return <Notice title="Not connected yet.">Your events show up here once the Registro API is connected.</Notice>;
  }
  if (state.status === "loading") return <ListSkeleton label="Gathering your events" />;
  if (state.status === "failed") {
    return state.signedOut ? (
      <Notice
        title="You're signed out."
        action={
          <Link href={`/signin?next=${encodeURIComponent("/hosting")}`} className={primaryButton}>
            Sign in
          </Link>
        }
      >
        {state.message}
      </Notice>
    ) : (
      <Notice
        title="Couldn't load your events."
        action={
          <button type="button" className={linkClass} onClick={retry}>
            Try again
          </button>
        }
      >
        {state.message}
      </Notice>
    );
  }
  if (state.events.length === 0) {
    return (
      <Notice
        title="You're not hosting anything yet."
        action={
          <Link href="/hosting/new" className={primaryButton}>
            Host an event
          </Link>
        }
      >
        Set one up in a couple of minutes. Save it as a draft until you&apos;re ready.
      </Notice>
    );
  }

  const done = (e: RegistroEvent) => e.status === "Cancelled" || e.status === "Completed" || hasStarted(e);
  const ahead = state.events.filter((e) => !done(e));
  const behind = state.events.filter(done).reverse();
  const going = ahead.filter((e) => e.status === "Published").reduce((sum, e) => sum + e.registration_count, 0);

  return (
    <div className="flex flex-col gap-12">
      <p className="text-paper/75">
        {ahead.length === 1 ? "1 event coming up" : `${ahead.length} events coming up`}
        {" · "}
        {going === 1 ? "1 person going" : `${going} people going`}
      </p>
      {ahead.length > 0 ? <HostingList title="Coming up" events={ahead} /> : null}
      {behind.length > 0 ? <HostingList title="Past and cancelled" events={behind} muted /> : null}
    </div>
  );
}

function HostingList({ title, events, muted = false }: { title: string; events: RegistroEvent[]; muted?: boolean }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold tracking-[0.12em] text-muted uppercase">{title}</h2>
      <ul>
        {events.map((event) => (
          <li key={event.event_id}>
            <HostingRow event={event} muted={muted} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HostingRow({ event, muted }: { event: RegistroEvent; muted: boolean }) {
  const date = eventDateParts(event);
  const fill = event.capacity ? Math.min(1, event.registration_count / event.capacity) : null;

  return (
    <Link
      href={`/hosting/${event.event_id}`}
      className={`group grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border-t border-line py-4 outline-none focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper sm:grid-cols-[8rem_minmax(0,1fr)_12rem] ${muted ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-panel">
        <Cover url={coverFor(event).url} sizes="160px" />
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-paper px-1.5 py-0.5 text-[0.65rem] font-bold text-ink uppercase tabular-nums">
          {date.month} {date.day}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-display text-lg leading-tight font-semibold tracking-tight underline-offset-4 group-hover:underline">
            {event.title}
          </h3>
          <StatusLabel status={event.status} />
        </div>
        <p className="text-sm break-words text-muted">
          {date.time} · {event.location}
        </p>
      </div>
      <div className="col-start-2 flex flex-col gap-2 sm:col-start-3">
        <p className="text-sm text-paper/80 tabular-nums">
          {event.capacity === null
            ? `${event.registration_count} going · no limit`
            : `${event.registration_count} of ${event.capacity} going`}
        </p>
        {fill !== null ? (
          <div className="h-1 overflow-hidden rounded-full bg-paper/10" aria-hidden="true">
            <div className={`h-full rounded-full ${fill >= 1 ? "bg-ember" : "bg-paper/70"}`} style={{ width: `${fill * 100}%` }} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
