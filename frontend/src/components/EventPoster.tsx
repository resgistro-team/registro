import Link from "next/link";
import type { ReactNode } from "react";
import { Cover } from "@/components/Cover";
import { coverFor } from "@/lib/covers";
import { availability, eventDateParts, type RegistroEvent } from "@/lib/events";

/**
 * An event as a poster: the cover carries the mood, the date badge answers "when" at a glance,
 * and the foot gives just enough to decide whether to open it.
 */
export function EventPoster({
  event,
  featured = false,
  href = `/events/${event.event_id}`,
  note,
  muted = false,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
  event: RegistroEvent;
  featured?: boolean;
  href?: string;
  /** Replaces the turnout line, for lists where something else matters more. */
  note?: ReactNode;
  muted?: boolean;
  sizes?: string;
}) {
  const date = eventDateParts(event);
  const cover = coverFor(event);
  const space = availability(event);

  return (
    <Link
      href={href}
      className={`group relative isolate flex h-full min-h-[15rem] flex-col justify-end overflow-hidden rounded-3xl bg-panel outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper ${muted ? "opacity-55 saturate-50" : ""}`}
    >
      <Cover
        url={cover.url}
        sizes={featured ? "(min-width: 1024px) 66vw, 100vw" : sizes}
        priority={featured}
        className="-z-20 transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
      />
      {/* Darkens the foot so the type reads on any photo. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(2_3_8/0.05)_25%,rgb(2_3_8/0.55)_60%,rgb(2_3_8/0.92)_100%)]" />

      <span className="absolute top-4 left-4 flex flex-col items-center rounded-xl bg-paper px-2.5 py-1.5 leading-none text-ink shadow-[0_6px_20px_rgb(0_0_0/0.25)]">
        <span className="text-[0.62rem] font-bold tracking-[0.12em] uppercase">{date.weekday}</span>
        <span className="mt-1 font-display text-xl font-semibold tracking-tight tabular-nums">{date.day}</span>
      </span>
      {event.category ? (
        <span className="absolute top-4 right-4 rounded-full bg-ink/55 px-3 py-1 text-[0.72rem] font-semibold text-paper/90 backdrop-blur-sm">
          {event.category}
        </span>
      ) : null}

      <div className={`flex flex-col gap-1.5 p-5 ${featured ? "sm:p-7" : ""}`}>
        <h3
          className={`font-display leading-[1.05] font-semibold tracking-[-0.02em] text-balance ${featured ? "text-3xl sm:text-[2.6rem]" : "text-xl sm:text-[1.4rem]"}`}
        >
          {event.title}
        </h3>
        <p className="text-sm break-words text-paper/80">
          {date.time} · {event.location}
        </p>
        <p className="text-[0.8rem] text-paper/75">
          {note !== undefined ? (
            note
          ) : space ? (
            <span className={space.tone === "low" ? "font-semibold text-ember" : "font-semibold text-paper"}>{space.label}</span>
          ) : (
            event.registration_count === 0 ? (
              <span>Be the first</span>
            ) : (
              <span className="tabular-nums">{event.registration_count} going</span>
            )
          )}
        </p>
      </div>
    </Link>
  );
}
