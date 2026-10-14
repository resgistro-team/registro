import Link from "next/link";
import { Suspense } from "react";
import { quietButton } from "@/components/Notice";
import { PosterWall, PosterWallFallback, type WallFilters } from "@/components/PosterWall";
import { SiteNav } from "@/components/SiteNav";
import { Typewriter } from "@/components/hero/Typewriter";

/** The slogan first, then the lines that nudge people out the door. */
const LINES = [
  "Everything happening.",
  "Are you coming?",
  "Why you indoors?",
  "Touch grass.",
  "Too much outside to be inside.",
] as const;

export default function Home({ searchParams }: PageProps<"/">) {
  const filters = searchParams.then(
    (params): WallFilters => ({
      q: typeof params.q === "string" ? params.q : undefined,
      category: typeof params.category === "string" ? params.category : undefined,
      when: typeof params.when === "string" ? params.when : undefined,
    }),
  );

  return (
    <>
      <SiteNav />
      <main id="wall" className="mx-auto w-full max-w-7xl flex-1 scroll-mt-20 px-6 pt-10 pb-20 sm:px-10 sm:pt-14 lg:px-16">
        <header className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="sr-only">Registro, everything happening</h1>
            <Typewriter
              lines={LINES}
              active
              className="min-h-[3.05em] font-display text-[clamp(2.6rem,7vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:min-h-[2.05em]"
            />
            <p className="max-w-[46ch] text-[1.02rem] text-paper/70">
              Concerts, workshops, games, meetups. Find one, save your spot, show up.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <form action="/#wall" method="get" role="search" className="flex w-full gap-2 sm:w-auto">
              <label htmlFor="wall-search" className="sr-only">
                Search events
              </label>
              <input
                id="wall-search"
                name="q"
                type="search"
                placeholder="Search events, places"
                className="w-full min-w-0 rounded-full border border-line bg-panel px-5 py-3 text-[0.95rem] text-paper outline-none placeholder:text-muted/70 focus:border-paper/70 sm:w-72"
              />
            </form>
            <Link href="/hosting/new" className={`${quietButton} shrink-0`}>
              Host an event
            </Link>
          </div>
        </header>

        <Suspense fallback={<PosterWallFallback />}>
          <PosterWall filters={filters} />
        </Suspense>
      </main>
    </>
  );
}
