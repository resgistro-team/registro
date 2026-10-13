"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventPoster } from "@/components/EventPoster";
import { Notice, linkClass, primaryButton } from "@/components/Notice";
import { apiConfigured, explain } from "@/lib/api";
import type { MyEventItem, MyEvents } from "@/lib/events";
import { useAuthedRequest } from "@/lib/use-viewer";

type State = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; data: MyEvents };

/**
 * What you're going to, then what you went to. A spot you gave up yourself is left out;
 * an event the host called off stays, because you'd want to know.
 */
export function MyEventsList() {
  const call = useAuthedRequest();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!apiConfigured) return;
    let live = true;
    call<MyEvents>("/api/users/my-events")
      .then((data) => live && setState({ status: "ready", data }))
      .catch((error) => live && setState({ status: "failed", message: explain(error) }));
    return () => {
      live = false;
    };
  }, [call]);

  if (!apiConfigured) {
    return <Notice title="Not connected yet.">Your events show up here once the Registro API is connected.</Notice>;
  }
  if (state.status === "loading") return <ListSkeleton />;
  if (state.status === "failed") {
    return (
      <Notice
        title="Couldn't load your events."
        action={
          <button type="button" className={linkClass} onClick={() => window.location.reload()}>
            Try again
          </button>
        }
      >
        {state.message}
      </Notice>
    );
  }

  const keep = (item: MyEventItem) =>
    item.registration.registration_status === "Registered" || item.event.status === "Cancelled";
  const upcoming = state.data.upcoming.filter(keep);
  const past = state.data.past.filter((item) => item.registration.registration_status === "Registered");

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <Notice
        title="Nothing yet."
        action={
          <Link href="/#events" className={primaryButton}>
            See what&apos;s on
          </Link>
        }
      >
        Register for something and it shows up here.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="mb-4 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
          Coming up
        </h2>
        {upcoming.length === 0 ? (
          <p className="border-t border-line py-6 text-paper/70">
            Nothing coming up.{" "}
            <Link href="/#events" className={linkClass}>
              Find something
            </Link>
          </p>
        ) : (
          <ul className="grid auto-rows-[16rem] gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {upcoming.map((item) => {
              const calledOff = item.event.status === "Cancelled";
              return (
                <li key={item.registration.registration_id}>
                <EventPoster
                  event={item.event}
                  muted={calledOff}
                  note={
                    calledOff ? (
                      <span className="font-semibold text-ember">Called off by the host</span>
                    ) : (
                      <span className="font-semibold text-paper">You&apos;re going</span>
                    )
                  }
                />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="mb-4 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
            Been there
          </h2>
          <ul className="grid auto-rows-[13rem] gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {past.map((item) => (
              <li key={item.registration.registration_id}>
                <EventPoster event={item.event} muted note={<span>You went</span>} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="grid auto-rows-[16rem] gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-3xl bg-paper/5" />
      ))}
    </div>
  );
}
