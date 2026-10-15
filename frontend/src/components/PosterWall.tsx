import Link from "next/link";
import { connection } from "next/server";
import { EventPoster } from "@/components/EventPoster";
import { HostEventLink } from "@/components/HostEventLink";
import { LightsLoading } from "@/components/LightsLoading";
import { Notice, linkClass } from "@/components/Notice";
import { listEvents } from "@/lib/api";
import { windowFor, type TimeWindow } from "@/lib/campus-time";

export interface WallFilters {
  q?: string;
  category?: string;
  when?: string;
}

const WHEN: { key: TimeWindow | ""; label: string }[] = [
  { key: "", label: "Anytime" },
  { key: "today", label: "Today" },
  { key: "weekend", label: "This weekend" },
  { key: "week", label: "Next 7 days" },
];

function href(filters: WallFilters, change: Partial<WallFilters>) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.when) params.set("when", next.when);
  if (next.category) params.set("category", next.category);
  const query = params.toString();
  return query ? `/?${query}#wall` : "/#wall";
}

/**
 * Upcoming events as a wall of posters, soonest first, with the very next one large.
 * Every filter lives in the URL, so any view can be shared or bookmarked.
 */
export async function PosterWall({ filters: pending }: { filters: Promise<WallFilters> }) {
  await connection();
  const filters = await pending;
  const when = WHEN.some((w) => w.key === filters.when) ? (filters.when as TimeWindow) : undefined;
  const window = when ? windowFor(when) : undefined;

  let all, shown;
  try {
    [all, shown] = await Promise.all([
      listEvents(),
      listEvents({ query: filters.q, category: filters.category, from: window?.from, to: window?.to }),
    ]);
  } catch {
    return (
      <Notice title="Events aren't loading right now." action={<Link href="/" className={linkClass}>Try again</Link>}>
        Couldn&apos;t reach Registro. Give it a moment.
      </Notice>
    );
  }

  // Categories come from what is actually on, never a fixed list.
  const categories = [...new Set(all.events.map((e) => e.category).filter(Boolean) as string[])].sort();
  const filtered = Boolean(filters.q || filters.category || when);
  const [first, ...rest] = shown.events;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <nav aria-label="When" className="flex flex-wrap gap-2">
          {WHEN.map((w) => (
            <Chip key={w.key || "any"} label={w.label} href={href(filters, { when: w.key || undefined })} active={(when ?? "") === w.key} />
          ))}
        </nav>
        {categories.length > 1 ? (
          <nav aria-label="Category" className="flex flex-wrap gap-2">
            <Chip label="All kinds" href={href(filters, { category: undefined })} active={!filters.category} quiet />
            {categories.map((c) => (
              <Chip key={c} label={c} href={href(filters, { category: c })} active={c === filters.category} quiet />
            ))}
          </nav>
        ) : null}
      </div>

      {!first ? (
        <Notice
          title={filtered ? "Nothing matches that." : "Nothing on yet."}
          action={
            filtered ? (
              <Link href="/#wall" className={linkClass}>
                Show everything
              </Link>
            ) : (
              <HostEventLink className={linkClass}>Host something</HostEventLink>
            )
          }
        >
          {filtered ? "Try another day or another word." : "Be the first to put something on."}
        </Notice>
      ) : (
        <ul className="grid auto-rows-[17rem] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          <li className={rest.length > 0 ? "sm:col-span-2 sm:row-span-2" : "sm:col-span-2"}>
            <EventPoster event={first} featured />
          </li>
          {rest.map((event) => (
            <li key={event.event_id}>
              <EventPoster event={event} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        {shown.sample ? "Sample events until the API is connected. " : ""}
        Cover photos from{" "}
        <a href="https://unsplash.com/?utm_source=registro&utm_medium=referral" className="underline-offset-2 hover:underline">
          Unsplash
        </a>
        .
      </p>
    </div>
  );
}

function Chip({ label, href, active, quiet = false }: { label: string; href: string; active: boolean; quiet?: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors aria-[current=true]:border-paper aria-[current=true]:bg-paper aria-[current=true]:font-semibold aria-[current=true]:text-ink ${
        quiet ? "border-line/70 text-paper/60 hover:text-paper" : "border-line text-paper/80 hover:border-paper/50 hover:text-paper"
      }`}
    >
      {label}
    </Link>
  );
}

/** The wall while its events load: the lights come on before the posters do. */
export function PosterWallFallback() {
  return <LightsLoading label="Turning the lights on" />;
}
