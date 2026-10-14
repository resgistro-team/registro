import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { AddToCalendar, OpenMap } from "@/components/events/EventActions";
import { RsvpPanel } from "@/components/events/RsvpPanel";
import { getEvent } from "@/lib/api";
import { coverFor } from "@/lib/covers";
import { eventDateParts, longDate, timeRange } from "@/lib/events";

export const metadata: Metadata = { title: "Event · Registro" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventDetail params={params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { event, sample } = await getEvent(id);
  if (!event) notFound();

  const date = eventDateParts(event);
  const cover = coverFor(event);

  return (
    <article className="flex flex-col">
      {/* The cover is the event's place. The title sits on its foot, like a poster. */}
      <div className="relative isolate -mx-6 -mt-10 flex min-h-[19rem] flex-col justify-end overflow-hidden sm:-mx-10 sm:-mt-14 sm:min-h-[24rem] sm:rounded-b-[2rem] lg:mx-0 lg:mt-0 lg:min-h-[26rem] lg:rounded-[2rem]">
        <Cover url={cover.url} sizes="(min-width: 1280px) 1150px, 100vw" priority className="-z-20" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(2_3_8/0.15)_20%,rgb(2_3_8/0.6)_60%,rgb(2_3_8/0.95)_100%)]" />
        <Link
          href="/#wall"
          className="absolute top-5 left-6 rounded-full bg-ink/55 px-3.5 py-1.5 text-sm font-medium text-paper/90 backdrop-blur-sm transition-colors hover:text-paper sm:left-8"
        >
          ← All events
        </Link>
        <div className="flex flex-col gap-3 px-6 pb-7 sm:px-10 sm:pb-9">
          <span className="text-xs font-semibold tracking-[0.14em] text-paper/80 uppercase">
            {event.category ? `${event.category} · ` : ""}Hosted by {event.organizer_name}
          </span>
          <h1 className="max-w-[20ch] font-display text-[clamp(2.1rem,6vw,4rem)] leading-[1] font-semibold tracking-[-0.035em] text-balance">
            {event.title}
          </h1>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-8">
          <ul className="flex flex-col">
            <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line pb-5">
              <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-line bg-panel leading-none">
                <span className="text-[0.62rem] font-bold tracking-[0.12em] text-muted uppercase">{date.weekday}</span>
                <span className="mt-1 font-display text-xl font-semibold tabular-nums">{date.day}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{longDate(event.start_datetime)}</span>
                <span className="text-sm text-muted tabular-nums">{timeRange(event)}</span>
              </span>
              <AddToCalendar event={event} />
            </li>
            <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line py-5">
              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-panel">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-paper/80">
                  <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium break-words">{event.location}</span>
                <span className="text-sm text-muted">Eastern Michigan University</span>
              </span>
              <OpenMap location={event.location} />
            </li>
          </ul>

          <div className="max-w-[65ch] text-[1.05rem] leading-relaxed whitespace-pre-line text-paper/85">{event.description}</div>

          {cover.credit ? <p className="text-xs text-muted">Cover photo by {cover.credit} on Unsplash.</p> : null}
        </div>

        {/* On a phone the decision comes straight after the cover; on a wide screen it rides alongside. */}
        <div className="order-first lg:sticky lg:top-28 lg:order-none lg:self-start">
          <RsvpPanel initial={event} sample={sample} />
        </div>
      </div>
    </article>
  );
}

function EventSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-10">
      <div className="h-[24rem] rounded-[2rem] bg-paper/5" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div className="flex flex-col gap-6">
          <div className="h-20 rounded-lg bg-paper/5" />
          <div className="h-32 rounded-lg bg-paper/5" />
        </div>
        <div className="h-40 rounded-3xl bg-paper/5" />
      </div>
    </div>
  );
}
