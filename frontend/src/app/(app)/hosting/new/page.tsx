import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/hosting/EventForm";

export const metadata: Metadata = { title: "Host an event · Registro" };

export default function NewEventPage() {
  return (
    <div className="flex max-w-[44rem] flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link href="/hosting" className="self-start text-sm font-medium text-muted transition-colors hover:text-paper">
          ← Hosting
        </Link>
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
          What&apos;s happening?
        </h1>
        <p className="text-paper/70">Publish it now, or save a draft and come back.</p>
      </header>
      <EventForm />
    </div>
  );
}
