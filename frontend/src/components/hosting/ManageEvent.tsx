"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormAlert } from "@/components/auth/fields";
import { Notice, linkClass, primaryButton, quietButton } from "@/components/Notice";
import { apiConfigured, explain } from "@/lib/api";
import { hasStarted, longDate, timeRange, type Attendee, type RegistroEvent } from "@/lib/events";
import { useAuthedRequest } from "@/lib/use-viewer";
import { EventForm } from "./EventForm";
import { StatusLabel } from "./StatusLabel";

type Loaded = RegistroEvent & { attendees: Attendee[] };
type State = { status: "loading" } | { status: "failed"; message: string; missing: boolean } | { status: "ready"; event: Loaded };

const CREATED: Record<string, string> = {
  publish: "It's live. People can find it and register now.",
  draft: "Saved as a draft. Only you can see it until you publish.",
};

/** Everything a host does to one event: edit it, change who can see it, and see who's coming. */
export function ManageEvent({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const call = useAuthedRequest();
  const [state, setState] = useState<State>({ status: "loading" });
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const created = CREATED[params.get("created") ?? ""];

  useEffect(() => {
    if (!apiConfigured) return;
    let live = true;
    call<Loaded>(`/api/events/organizer/${encodeURIComponent(id)}`)
      .then((event) => live && setState({ status: "ready", event }))
      .catch((error) => {
        if (!live) return;
        const code = (error as { code?: string }).code;
        setState({
          status: "failed",
          message: explain(error),
          missing: code === "EVENT_NOT_FOUND" || code === "FORBIDDEN" || code === "INVALID_INPUT",
        });
      });
    return () => {
      live = false;
    };
  }, [call, id]);

  if (!apiConfigured) return <Notice title="Not connected yet.">Editing opens once the Registro API is connected.</Notice>;
  if (state.status === "loading") {
    return <div aria-hidden="true" className="h-96 rounded-3xl bg-paper/5" />;
  }
  if (state.status === "failed") {
    return (
      <Notice
        title={state.missing ? "That event isn't yours to manage." : "Couldn't load this event."}
        action={
          <Link href="/hosting" className={linkClass}>
            Back to hosting
          </Link>
        }
      >
        {state.missing ? "It may have been deleted, or it belongs to someone else." : state.message}
      </Notice>
    );
  }

  const event = state.event;
  const going = event.attendees.length;
  const started = hasStarted(event);

  async function setStatus(status: "Published" | "Cancelled") {
    setPending(true);
    setActionError(null);
    try {
      const result = await call<{ event: RegistroEvent }>(`/api/events/${event.event_id}/status`, {
        method: "PATCH",
        body: { status },
      });
      // Cancelling also cancels everyone's spot, so the list is empty afterwards.
      setState({
        status: "ready",
        event: { ...event, ...result.event, attendees: status === "Cancelled" ? [] : event.attendees },
      });
      setConfirm(null);
      router.refresh();
    } catch (error) {
      setActionError(explain(error));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setActionError(null);
    try {
      await call(`/api/events/${event.event_id}`, { method: "DELETE" });
      router.push("/hosting");
      router.refresh();
    } catch (error) {
      setActionError(explain(error));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link href="/hosting" className="self-start text-sm font-medium text-muted transition-colors hover:text-paper">
          ← Hosting
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
            {event.title}
          </h1>
          <StatusLabel status={event.status} />
        </div>
        <p className="text-paper/70">
          {longDate(event.start_datetime)} · <span className="tabular-nums">{timeRange(event)}</span>
        </p>
        {created ? (
          <p role="status" className="rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm text-paper/85">
            {created}
          </p>
        ) : null}
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <section aria-labelledby="details-heading" className="min-w-0">
          <h2 id="details-heading" className="mb-6 text-sm font-semibold tracking-[0.12em] text-muted uppercase">
            Details
          </h2>
          <EventForm
            event={event}
            onSaved={(saved) => setState({ status: "ready", event: { ...event, ...saved } })}
          />
        </section>

        <div className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
          <section aria-labelledby="visibility-heading" className="flex flex-col gap-4 rounded-3xl border border-line bg-ink/60 p-6">
            <h2 id="visibility-heading" className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
              Who can see it
            </h2>
            {actionError ? <FormAlert>{actionError}</FormAlert> : null}

            {event.status === "Draft" ? (
              <>
                <p className="text-sm text-paper/80">Only you. Publish it and anyone can find it and register.</p>
                <button type="button" disabled={pending || started} onClick={() => setStatus("Published")} className={primaryButton}>
                  {pending ? "Publishing…" : "Publish"}
                </button>
                {started ? <p className="text-xs text-muted">Its start time has passed. Move it to the future first.</p> : null}
              </>
            ) : null}

            {event.status === "Published" ? (
              <>
                <p className="text-sm text-paper/80">Everyone. It&apos;s live.</p>
                <Link href={`/events/${event.event_id}`} className={quietButton}>
                  View public page
                </Link>
              </>
            ) : null}

            {event.status === "Cancelled" ? (
              <p className="text-sm text-paper/80">Nobody. It&apos;s cancelled, and everyone&apos;s spot was released.</p>
            ) : null}

            {event.status === "Completed" ? <p className="text-sm text-paper/80">It&apos;s over.</p> : null}

            {/* Leaving is quieter than going live, and always asks first. */}
            {event.status === "Published" && !started ? (
              confirm === "cancel" ? (
                <ConfirmBox
                  message={
                    going > 0
                      ? `Cancel it? ${going === 1 ? "The 1 person" : `All ${going} people`} going lose${going === 1 ? "s" : ""} their spot, and it can't be undone.`
                      : "Cancel it? It comes off the public list, and it can't be undone."
                  }
                  confirmLabel={pending ? "Cancelling…" : "Yes, cancel event"}
                  pending={pending}
                  onConfirm={() => setStatus("Cancelled")}
                  onBack={() => setConfirm(null)}
                />
              ) : (
                <button type="button" onClick={() => setConfirm("cancel")} className="self-start text-sm font-medium text-muted underline-offset-4 hover:text-paper hover:underline">
                  Cancel event
                </button>
              )
            ) : null}

            {event.status === "Draft" ? (
              confirm === "delete" ? (
                <ConfirmBox
                  message="Delete this draft? It's gone for good."
                  confirmLabel={pending ? "Deleting…" : "Yes, delete"}
                  pending={pending}
                  onConfirm={remove}
                  onBack={() => setConfirm(null)}
                />
              ) : (
                <button type="button" onClick={() => setConfirm("delete")} className="self-start text-sm font-medium text-muted underline-offset-4 hover:text-paper hover:underline">
                  Delete draft
                </button>
              )
            ) : null}
          </section>

          <section aria-labelledby="going-heading" className="flex flex-col gap-4">
            <h2 id="going-heading" className="text-sm font-semibold tracking-[0.12em] text-muted uppercase">
              Who&apos;s going
              <span className="ml-2 text-paper tabular-nums">
                {event.capacity === null ? going : `${going} / ${event.capacity}`}
              </span>
            </h2>
            {going === 0 ? (
              <p className="border-t border-line pt-4 text-sm text-paper/65">
                {event.status === "Published" ? "Nobody yet. Share the link." : "Nobody yet."}
              </p>
            ) : (
              <ul className="flex flex-col">
                {event.attendees.map((person) => (
                  <li key={person.registration_id} className="flex min-w-0 flex-col border-t border-line py-3">
                    <span className="text-[0.95rem] text-paper">{person.name}</span>
                    <span className="text-sm break-all text-muted">{person.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ConfirmBox({
  message,
  confirmLabel,
  pending,
  onConfirm,
  onBack,
}: {
  message: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div role="group" aria-label="Confirm" className="flex flex-col gap-3 rounded-2xl border border-ember/40 bg-ember/5 p-4">
      <p className="text-sm text-paper/90">{message}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="rounded-full bg-paper/10 px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-paper/20 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={onBack} className="rounded-full px-4 py-2 text-sm font-medium text-paper/70 hover:text-paper">
          Keep it
        </button>
      </div>
    </div>
  );
}
