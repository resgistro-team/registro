"use client";

import Link from "next/link";
import { Cover } from "@/components/Cover";
import { coverFor } from "@/lib/covers";
import { eventDateParts, untilStart } from "@/lib/events";
import { useMyPlans } from "@/lib/my-plans";
import { useNow } from "@/lib/use-now";
import { useViewer } from "@/lib/use-viewer";

/**
 * The one thing a returning person most wants to know: when is the thing I said yes to?
 * Only appears when there is an answer; a signed-out or uncommitted visitor sees nothing.
 */
export function NextUp() {
  const viewer = useViewer();
  const plans = useMyPlans(viewer.status === "signed-in");
  // Null during the server render, so the countdown never disagrees with it.
  const now = useNow();

  if (plans.status !== "ready" || now === null) return null;
  const next = plans.upcoming.find((item) => new Date(item.event.end_datetime).getTime() > now)?.event;
  if (!next) return null;

  const date = eventDateParts(next);
  const more = plans.upcoming.length - 1;
  const when = date.relative ?? `${date.weekday} ${date.month} ${date.day}`;

  return (
    <section aria-label="Your next event" className="ask-in lifted mb-8 w-fit max-w-full">
      {/* The whole strip opens the event; "+N more" sits above that link and goes to My events. */}
      {/* Sized to what it says, not stretched across the page: it's a reminder, not a banner. */}
      <div className="ticket-stub group relative flex w-fit max-w-full items-center gap-3 edge edge-glass edge-hover rounded-[1.4rem] p-2 pr-3 backdrop-blur-sm transition-[transform,--edge-top] duration-300 hover:-translate-y-0.5">
        <span className="relative size-14 shrink-0 overflow-hidden rounded-[0.95rem]">
          <Cover url={coverFor(next).url} sizes="72px" />
        </span>
        <span aria-hidden="true" className="perforation -my-2 w-px self-stretch" />
        <span className="flex min-w-0 flex-col gap-0.5 pr-2">
          <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted uppercase">
            Next up · {untilStart(next.start_datetime, now)}
          </span>
          <Link
            href={`/events/${next.event_id}`}
            className="truncate font-display text-[1.05rem] leading-tight font-semibold outline-none after:absolute after:inset-0 after:rounded-[1.4rem] focus-visible:after:outline-2 focus-visible:after:outline-paper"
          >
            {next.title}
          </Link>
          <span className="truncate text-sm text-paper/70">
            {when}, {date.time} · {next.location}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-3 text-sm text-muted sm:flex">
          {more > 0 ? (
            <Link href="/me" className="relative z-10 rounded-full px-3 py-1.5 transition-colors hover:bg-paper/10 hover:text-paper">
              +{more} more
            </Link>
          ) : null}
          <svg viewBox="0 0 24 24" className="size-5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </section>
  );
}
