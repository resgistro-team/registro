import Link from "next/link";
import type { ReactNode } from "react";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { Logo } from "@/components/Logo";
import { authConfigured } from "@/lib/supabase/config";

/**
 * Every account screen shares this frame: a night out playing behind, the form in front.
 * Only the form swaps between screens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-space">
      <AuthBackdrop />
      {/* Dark where the form is, open where the action is. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(2_3_8/0.96)_0%,rgb(2_3_8/0.88)_36%,rgb(2_3_8/0.45)_70%,rgb(2_3_8/0.28)_100%)] max-md:bg-[linear-gradient(180deg,rgb(2_3_8/0.3)_0%,rgb(2_3_8/0.78)_40%,rgb(2_3_8/0.92)_100%)]"
      />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 pt-6 sm:px-10 lg:px-16">
        <Link
          href="/"
          aria-label="Registro home"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
        >
          <Logo />
        </Link>
        {authConfigured ? null : (
          <span className="rounded-full border border-line bg-ink/60 px-3 py-1 text-[0.7rem] font-medium tracking-wide text-muted">
            Preview · accounts aren&apos;t saved yet
          </span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-12 sm:px-10 lg:px-16">
        {/* No card: the form stands in the night itself. The scrim behind does the legibility work. */}
        <div className="w-full max-w-[24rem]">
          {children}
        </div>
      </main>
    </div>
  );
}
