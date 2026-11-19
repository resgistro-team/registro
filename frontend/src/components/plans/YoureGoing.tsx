"use client";

import type { ReactNode } from "react";
import { useMyPlans } from "@/lib/my-plans";
import { useViewer } from "@/lib/use-viewer";

/** On a poster: "You're going" when the viewer is, otherwise whatever the poster would say. */
export function YoureGoing({ eventId, children }: { eventId: string; children?: ReactNode }) {
  const viewer = useViewer();
  const plans = useMyPlans(viewer.status === "signed-in");
  if (plans.status === "ready" && plans.going.has(eventId)) {
    return (
      <span className="mark-in inline-flex items-center gap-1.5 font-semibold text-paper">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
        You&apos;re going
      </span>
    );
  }
  return <>{children}</>;
}
