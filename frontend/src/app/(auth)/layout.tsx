import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { authConfigured } from "@/lib/supabase/config";
import nightLights from "../../../public/auth-night.jpg";

/**
 * Every account screen shares this frame: the same night-lit Michigan the hero lands on,
 * with the form in the column where the hero's copy sits. Only the form swaps between screens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-space">
      <Image
        src={nightLights}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="auth-drift -z-20 object-cover object-[62%_50%]"
      />
      {/* Dark where the form is, open where the cities are. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(2_3_8/0.94)_0%,rgb(2_3_8/0.84)_38%,rgb(2_3_8/0.35)_72%,rgb(2_3_8/0.2)_100%)] max-md:bg-[linear-gradient(180deg,rgb(2_3_8/0.3)_0%,rgb(2_3_8/0.78)_40%,rgb(2_3_8/0.92)_100%)]"
      />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 pt-6 sm:px-10 lg:px-16">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-[-0.03em] text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
        >
          Registro
        </Link>
        {authConfigured ? null : (
          <span className="rounded-full border border-line bg-ink/60 px-3 py-1 text-[0.7rem] font-medium tracking-wide text-muted">
            Preview · accounts aren&apos;t saved yet
          </span>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-[26rem] rounded-3xl border border-line/70 bg-ink/55 p-7 backdrop-blur-md sm:p-9">
          {children}
        </div>
      </main>
    </div>
  );
}
