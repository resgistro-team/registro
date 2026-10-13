import type { Metadata } from "next";
import { MyEventsList } from "@/components/me/MyEventsList";

export const metadata: Metadata = { title: "My events · Registro" };

export default function MyEventsPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
          My events
        </h1>
        <p className="text-paper/70">Everything you said you&apos;re coming to.</p>
      </header>
      <MyEventsList />
    </div>
  );
}
