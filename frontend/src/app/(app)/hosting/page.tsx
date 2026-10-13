import type { Metadata } from "next";
import Link from "next/link";
import { HostingDashboard } from "@/components/hosting/HostingDashboard";
import { primaryButton } from "@/components/Notice";

export const metadata: Metadata = { title: "Hosting · Registro" };

export default function HostingPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
            Hosting
          </h1>
          <p className="text-paper/70">What you&apos;re putting on, and who&apos;s coming.</p>
        </div>
        <Link href="/hosting/new" className={primaryButton}>
          Host an event
        </Link>
      </header>
      <HostingDashboard />
    </div>
  );
}
