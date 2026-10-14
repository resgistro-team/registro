import { CAMPUS_TIME_ZONE } from "./events";

/**
 * A `datetime-local` input has no time zone, so its value is read as campus time
 * (America/Detroit), not the browser's. An organizer travelling, or a laptop set to
 * another zone, still publishes the time people will actually show up.
 */

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function campusFields(ms: number) {
  const out: Record<string, number> = {};
  for (const p of parts.formatToParts(new Date(ms))) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

/** Milliseconds campus time is ahead of UTC at that instant (negative for Eastern). */
function campusOffset(ms: number) {
  const f = campusFields(ms);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-15T18:00" in campus time → ISO 8601 UTC. Null if the value isn't a full date and time. */
export function campusInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset across a daylight-saving change.
  let utc = wall - campusOffset(wall);
  utc = wall - campusOffset(utc);
  return new Date(utc).toISOString();
}

/** ISO 8601 → the "YYYY-MM-DDTHH:mm" a `datetime-local` input expects, in campus time. */
export function isoToCampusInput(iso: string): string {
  const f = campusFields(new Date(iso).getTime());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Today's date on campus, as year, month (1-12), day and weekday (0 = Sunday). */
export function campusToday(now = Date.now()) {
  const f = campusFields(now);
  const weekday = new Date(Date.UTC(f.year, f.month - 1, f.day)).getUTCDay();
  return { year: f.year, month: f.month, day: f.day, weekday };
}

/** Midnight on campus, `offsetDays` from today, as ISO UTC. */
export function campusMidnight(offsetDays: number, now = Date.now()) {
  const t = campusToday(now);
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day + offsetDays));
  return campusInputToIso(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T00:00`)!;
}

export type TimeWindow = "today" | "weekend" | "week";

/** [from, to) for the wall's time filters. The weekend runs Saturday to Monday morning. */
export function windowFor(when: TimeWindow, now = Date.now()): { from: string; to: string } {
  const nowIso = new Date(now).toISOString();
  if (when === "today") return { from: nowIso, to: campusMidnight(1, now) };
  if (when === "week") return { from: nowIso, to: new Date(now + 7 * 24 * 3600 * 1000).toISOString() };
  const { weekday } = campusToday(now);
  const toSaturday = (6 - weekday + 7) % 7;
  const start = weekday === 0 ? nowIso : weekday === 6 ? nowIso : campusMidnight(toSaturday, now);
  const toMonday = weekday === 0 ? 1 : 8 - weekday;
  return { from: start, to: campusMidnight(toMonday, now) };
}
