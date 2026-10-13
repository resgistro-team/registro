import type { EventStatus } from "@/lib/events";

/** Status in plain words. Only "Live" is lit, because it is the only state other people can see. */
const LABELS: Record<EventStatus, { text: string; live: boolean }> = {
  Published: { text: "Live", live: true },
  Draft: { text: "Draft", live: false },
  Cancelled: { text: "Cancelled", live: false },
  Completed: { text: "Done", live: false },
};

export function StatusLabel({ status }: { status: EventStatus }) {
  const { text, live } = LABELS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide ${
        live ? "border-paper/40 text-paper" : "border-line text-muted"
      }`}
    >
      {live ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-paper" /> : null}
      {text}
    </span>
  );
}
