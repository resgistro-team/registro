"use client";

import type { RegistroEvent } from "@/lib/events";

/** Campus name added to map searches, since rooms like "Room 201" mean nothing to a map on their own. */
const CAMPUS = "Eastern Michigan University, Ypsilanti, MI";

const pill =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[0.8rem] font-semibold text-paper/85 transition-colors hover:border-paper/50 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

export function mapUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location}, ${CAMPUS}`)}`;
}

function icsStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** RFC 5545 text: escape the characters calendars treat as syntax, and fold nothing (lines stay short enough). */
function icsText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A one-event .ics file. Works with Apple Calendar, Google Calendar and Outlook. */
function calendarFile(event: RegistroEvent, pageUrl: string) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Registro//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.event_id}@registro`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(event.start_datetime)}`,
    `DTEND:${icsStamp(event.end_datetime)}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(`${event.location}, ${CAMPUS}`)}`,
    `DESCRIPTION:${icsText(`${event.description}\n\n${pageUrl}`)}`,
    `URL:${pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function AddToCalendar({ event }: { event: RegistroEvent }) {
  return (
    <button
      type="button"
      className={pill}
      onClick={() => {
        const blob = new Blob([calendarFile(event, window.location.href)], { type: "text/calendar;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${event.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "event"}.ics`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }}
    >
      Add to calendar
    </button>
  );
}

export function OpenMap({ location }: { location: string }) {
  return (
    <a href={mapUrl(location)} target="_blank" rel="noreferrer" className={pill}>
      Open map
    </a>
  );
}
