"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/lib/auth";
import { useViewer } from "@/lib/use-viewer";

const LINKS = [
  { href: "/#events", label: "Events", match: (p: string) => p === "/" || p.startsWith("/events") },
  { href: "/me", label: "My events", match: (p: string) => p.startsWith("/me") },
  { href: "/hosting", label: "Hosting", match: (p: string) => p.startsWith("/hosting") },
];

/**
 * The one bar across the app. Over the hero it floats on the night sky; elsewhere it sits on the page.
 * Signed-out visitors see the events link and a way in, nothing that would bounce them to sign-in.
 *
 * It reads the URL, which only exists at request time, so it streams in behind a bar of the same size.
 */
export function SiteNav({ overHero = false }: { overHero?: boolean }) {
  return (
    <Suspense fallback={<NavBar overHero={overHero} />}>
      <NavContents overHero={overHero} />
    </Suspense>
  );
}

function NavBar({ overHero, children }: { overHero: boolean; children?: React.ReactNode }) {
  return (
    <header
      className={
        overHero
          ? "absolute inset-x-0 top-0 z-10"
          : "sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-line/70 bg-ink/80 backdrop-blur-md"
      }
    >
      {children ?? (
        <nav aria-label="Main" className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center px-6 sm:px-10 lg:px-16">
          {overHero ? null : (
            <Link href="/" className="font-display text-xl font-semibold tracking-[-0.03em] text-paper">
              Registro
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

function NavContents({ overHero }: { overHero: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const viewer = useViewer();
  const signedIn = viewer.status === "signed-in";
  const links = signedIn ? LINKS : LINKS.slice(0, 1);

  const pill =
    "rounded-full border border-paper/25 bg-ink/40 px-4 py-2 text-sm font-medium text-paper/90 backdrop-blur-sm transition-colors hover:border-paper/60 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

  return (
    <NavBar overHero={overHero}>
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-10 lg:px-16"
      >
        {overHero ? (
          // The hero itself is the wordmark, so the bar leaves room for it.
          <span />
        ) : (
          <Link href="/" className="font-display text-xl font-semibold tracking-[-0.03em] text-paper">
            Registro
          </Link>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const current = link.match(pathname) && !(overHero && link.href === "/#events");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className="rounded-full px-3 py-2 text-sm font-medium text-paper/70 transition-colors hover:text-paper aria-[current=page]:text-paper max-sm:hidden"
              >
                {link.label}
              </Link>
            );
          })}

          {viewer.status === "loading" ? (
            <span className="h-10 w-20" aria-hidden="true" />
          ) : signedIn ? (
            <div className="flex items-center gap-2 pl-1 sm:pl-2">
              <span className="text-sm text-paper/75 max-md:hidden">Hey, {viewer.account.name}</span>
              <button
                type="button"
                className={pill}
                onClick={async () => {
                  await signOut();
                  router.push("/");
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href={`/signin?next=${encodeURIComponent(pathname)}`} className={pill}>
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* Phones get the section links as a second row instead of hiding them. */}
      {signedIn ? (
        <div className="mx-auto flex w-full max-w-7xl gap-1 px-4 pb-3 sm:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.match(pathname) ? "page" : undefined}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-paper/65 aria-[current=page]:bg-paper/10 aria-[current=page]:text-paper"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </NavBar>
  );
}
