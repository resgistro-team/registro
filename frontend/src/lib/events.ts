/**
 * Event shapes exactly as the backend returns them after `json_ready()`.
 * Source of truth: docs/architecture/DATA_CONTRACT.md.
 */

export type EventStatus = "Draft" | "Published" | "Cancelled" | "Completed";

export interface RegistroEvent {
  event_id: string;
  organizer_id: string;
  title: string;
  description: string;
  image: string | null;
  category: string | null;
  location: string;
  /** ISO 8601, UTC, ending in Z. */
  start_datetime: string;
  end_datetime: string;
  /** null means unlimited. */
  capacity: number | null;
  status: EventStatus;
  created_at: string;
  organizer_name: string;
  registration_count: number;
  /** null means unlimited, 0 means full. */
  remaining_capacity: number | null;
}

export interface Registration {
  registration_id: string;
  event_id: string;
  user_id: string;
  registration_status: "Registered" | "Cancelled";
  registered_at: string;
}

export interface Attendee extends Registration {
  name: string;
  email: string;
}

export interface MyEventItem {
  registration: Registration;
  event: RegistroEvent;
}

export interface MyEvents {
  total: number;
  upcoming: MyEventItem[];
  past: MyEventItem[];
}

export interface Profile {
  user_id: string;
  name: string;
  email: string;
  profile_image: string | null;
}

/** Campus runs on Eastern time, whatever the visitor's own clock says. */
export const CAMPUS_TIME_ZONE = "America/Detroit";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIME_ZONE, ...options });

const weekday = fmt({ weekday: "short" });
const longWeekday = fmt({ weekday: "long" });
const dayOfMonth = fmt({ day: "numeric" });
const month = fmt({ month: "short" });
const longMonth = fmt({ month: "long" });
const clock = fmt({ hour: "numeric", minute: "2-digit" });
const dayKey = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });

export function eventDateParts(event: Pick<RegistroEvent, "start_datetime">) {
  const start = new Date(event.start_datetime);
  return {
    weekday: weekday.format(start),
    day: dayOfMonth.format(start),
    month: month.format(start),
    time: clock.format(start),
  };
}

/** "Thursday, October 15" */
export function longDate(iso: string) {
  const d = new Date(iso);
  return `${longWeekday.format(d)}, ${longMonth.format(d)} ${dayOfMonth.format(d)}`;
}

/** "6:00 – 8:00 PM", or with both days when it runs past midnight. */
export function timeRange(event: Pick<RegistroEvent, "start_datetime" | "end_datetime">) {
  const start = new Date(event.start_datetime);
  const end = new Date(event.end_datetime);
  const sameDay = dayKey.format(start) === dayKey.format(end);
  if (!sameDay) return `${clock.format(start)} – ${longDate(event.end_datetime)}, ${clock.format(end)}`;
  return `${clock.format(start)} – ${clock.format(end)}`;
}

export function hasStarted(event: Pick<RegistroEvent, "start_datetime">, now = Date.now()) {
  return new Date(event.start_datetime).getTime() <= now;
}

/** Only say something about space when it changes what a visitor should do. */
export function availability(event: RegistroEvent): { label: string; tone: "full" | "low" } | null {
  const left = event.remaining_capacity;
  if (left === null) return null;
  if (left <= 0) return { label: "Full", tone: "full" };
  if (left <= 5) return { label: left === 1 ? "1 spot left" : `${left} spots left`, tone: "low" };
  return null;
}

/** "27 going", or "27 of 30 going" when there is a cap. */
export function turnout(event: RegistroEvent) {
  const going = event.registration_count;
  return event.capacity === null ? `${going} going` : `${going} of ${event.capacity} going`;
}
