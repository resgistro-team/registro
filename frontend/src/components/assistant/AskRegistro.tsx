"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { explain } from "@/lib/api";
import { askRegistro, toolStatus, type FoundEvent, type Turn } from "@/lib/assistant";
import { getAccessToken } from "@/lib/auth";
import { useViewer } from "@/lib/use-viewer";

interface Message {
  role: "user" | "assistant";
  content: string;
  events?: FoundEvent[];
  /** What the assistant is doing right now, while a tool runs. */
  status?: string;
  error?: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "What's happening this weekend?",
  "Find me a tech event this week",
  "Anything with music tonight?",
  "What am I registered for?",
];

/** Pages where a chat button would get in the way: signing in, and the consent screen. */
const HIDDEN = ["/signin", "/signup", "/reset", "/update-password", "/oauth", "/auth"];

/**
 * Ask Registro: a chat that finds events and saves your spot. A small pill in the corner opens a
 * panel; answers stream in, and every event the assistant finds shows up as a card you can open.
 */
export function AskRegistro() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Once opened, the panel stays mounted while closed, so the conversation survives closing it
  // and moving between pages.
  const [started, setStarted] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (HIDDEN.some((path) => pathname.startsWith(path))) return null;
  return (
    <>
      {open ? null : (
        <Launcher
          onOpen={() => {
            setStarted(true);
            setOpen(true);
          }}
        />
      )}
      {started ? <Panel open={open} onClose={close} here={pathname} /> : null}
    </>
  );
}

function Launcher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ask-launcher fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 flex h-12 items-center gap-2 rounded-full bg-paper pr-5 pl-3.5 text-sm font-semibold text-ink shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper active:scale-[0.98] sm:right-6 sm:bottom-6"
    >
      <Spark className="size-5" />
      Ask Registro
    </button>
  );
}

function Panel({ open, onClose, here }: { open: boolean; onClose: () => void; here: string }) {
  const viewer = useViewer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Stop any answer in progress if the panel goes away for good.
  useEffect(() => () => abort.current?.abort(), []);

  // Follow the answer as it streams in.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const updateLast = useCallback((change: (last: Message) => Message) => {
    setMessages((all) => {
      const last = all[all.length - 1];
      // The chat may have been cleared while an answer was still arriving.
      return last?.role === "assistant" ? [...all.slice(0, -1), change(last)] : all;
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setDraft("");
      setBusy(true);

      // Only finished exchanges go back to the API, so the turns always alternate.
      const history: Turn[] = [];
      for (let i = 0; i + 1 < messages.length; i += 2) {
        const [asked, answered] = [messages[i], messages[i + 1]];
        if (answered.content.trim()) history.push({ role: "user", content: asked.content }, { role: "assistant", content: answered.content });
      }
      history.push({ role: "user", content: question });

      setMessages((all) => [...all, { role: "user", content: question }, { role: "assistant", content: "", streaming: true }]);
      const controller = new AbortController();
      abort.current = controller;

      try {
        const token = await getAccessToken();
        if (!token) throw new Error("signed-out");
        await askRegistro(
          history.slice(-20),
          token,
          (event) => {
            if (event.type === "text") updateLast((m) => ({ ...m, content: m.content + event.text, status: undefined }));
            else if (event.type === "tool") updateLast((m) => ({ ...m, status: toolStatus(event.name) }));
            else if (event.type === "events")
              updateLast((m) => ({ ...m, events: [...(m.events ?? []), ...event.events].slice(0, 12) }));
            else if (event.type === "error") updateLast((m) => ({ ...m, error: event.message }));
          },
          controller.signal,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error && error.message === "signed-out" ? "Your session ran out. Sign in again." : explain(error);
          updateLast((m) => ({ ...m, error: message }));
        }
      } finally {
        updateLast((m) => ({ ...m, streaming: false, status: undefined }));
        setBusy(false);
        abort.current = null;
        input.current?.focus();
      }
    },
    [busy, messages, updateLast],
  );

  const reset = () => {
    abort.current?.abort();
    setMessages([]);
    setBusy(false);
    input.current?.focus();
  };

  const signedIn = viewer.status === "signed-in";

  return (
    <div
      role="dialog"
      aria-label="Ask Registro"
      hidden={!open}
      className="ask-panel fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-50 flex h-[min(42rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-panel/80 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(42rem,calc(100dvh-3rem))] sm:w-[26rem]"
    >
      {/* A soft light behind the header, like the glow over a city at night. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_30%_0%,rgba(251,250,248,0.08),transparent)]" />

      <header className="relative flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="ask-orb grid size-9 place-items-center rounded-full bg-paper text-ink">
          <Spark className="size-[1.15rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] leading-tight font-semibold">Ask Registro</h2>
          <p className="text-xs text-muted">Finds events and saves your spot</p>
        </div>
        {messages.length > 0 ? (
          <IconButton label="New chat" onClick={reset}>
            <path d="M12 5v14M5 12h14" />
          </IconButton>
        ) : null}
        <IconButton label="Close" onClick={onClose}>
          <path d="M6 6l12 12M18 6L6 18" />
        </IconButton>
      </header>

      <div ref={scroller} className="relative flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
        {viewer.status === "loading" ? null : !signedIn ? (
          <SignInPitch here={here} />
        ) : messages.length === 0 ? (
          <Welcome name={viewer.account.name} onPick={send} />
        ) : (
          <ol className="space-y-6">
            {messages.map((message, i) => (
              <li key={i} className="ask-in">
                {message.role === "user" ? <UserBubble text={message.content} /> : <Answer message={message} onOpen={onClose} />}
              </li>
            ))}
          </ol>
        )}
      </div>

      {signedIn ? (
        <form
          className="relative border-t border-white/[0.06] px-3 pt-3 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <div className="flex items-end gap-2 rounded-[1.35rem] border border-line bg-ink/70 py-1.5 pr-1.5 pl-4 transition-colors focus-within:border-paper/25">
            <label htmlFor="ask-input" className="sr-only">
              Ask Registro
            </label>
            <textarea
              id="ask-input"
              ref={input}
              rows={1}
              value={draft}
              maxLength={2000}
              placeholder="Ask about events…"
              onChange={(event) => {
                setDraft(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 text-paper outline-none placeholder:text-muted"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                aria-label="Stop"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-paper/15 text-paper transition-colors hover:bg-paper/25"
              >
                <span className="size-3 rounded-[3px] bg-current" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={!draft.trim()}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-ink transition-[opacity,transform] duration-150 hover:scale-105 disabled:scale-100 disabled:opacity-25"
              >
                <svg viewBox="0 0 24 24" className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted/80">Answers come from Registro&apos;s live events. Double-check before you go.</p>
        </form>
      ) : null}
    </div>
  );
}

function Welcome({ name, onPick }: { name: string; onPick: (text: string) => void }) {
  const first = name.trim().split(/\s+/)[0];
  return (
    <div className="ask-in flex min-h-full flex-col justify-end pt-10">
      <h3 className="font-display text-[1.7rem] leading-[1.1] font-semibold tracking-tight">
        {first ? `Hey ${first}.` : "Hey."}
        <br />
        <span className="text-muted">What are you up for?</span>
      </h3>
      <p className="mt-3 text-sm text-muted">Ask in your own words. I can find events, explain them, and save your spot.</p>
      <ul className="mt-6 space-y-2">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => onPick(suggestion)}
              className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-ink/50 px-4 py-3 text-left text-sm text-paper/90 transition-colors hover:border-paper/25 hover:bg-ink/80"
            >
              {suggestion}
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-paper" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignInPitch({ here }: { here: string }) {
  return (
    <div className="ask-in flex min-h-full flex-col justify-end pt-10 pb-2">
      <h3 className="font-display text-[1.7rem] leading-[1.1] font-semibold tracking-tight">
        Tell it what you&apos;re into.
        <br />
        <span className="text-muted">It finds the event and saves your spot.</span>
      </h3>
      <p className="mt-3 text-sm text-muted">Sign in so Ask Registro can register you and see what you&apos;re going to.</p>
      <Link
        href={`/signin?next=${encodeURIComponent(here)}`}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-paper px-6 text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
      >
        Sign in
      </Link>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-[1.25rem] rounded-br-md bg-paper px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap text-ink">
      {text}
    </p>
  );
}

function Answer({ message, onOpen }: { message: Message; onOpen: () => void }) {
  const thinking = message.streaming && !message.content && !message.status;
  return (
    <div className="space-y-3">
      {message.status || thinking ? (
        <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <span className="ask-pulse size-1.5 rounded-full bg-paper" aria-hidden="true" />
          {message.status ?? "Thinking"}
        </p>
      ) : null}
      {message.content ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-paper/90">
          {message.content}
          {message.streaming && !message.status ? <span className="typewriter-caret" aria-hidden="true" /> : null}
        </p>
      ) : null}
      {message.events?.length ? (
        <ul className="ask-cards -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-5 px-5 pb-1">
          {message.events.map((event) => (
            <li key={event.event_id} className="snap-start">
              <EventCard event={event} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : null}
      {message.error ? <p className="text-sm text-muted">{message.error}</p> : null}
    </div>
  );
}

const when = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function EventCard({ event, onOpen }: { event: FoundEvent; onOpen: () => void }) {
  const left = event.spots_left;
  const scarce = left !== null && left <= 10;
  return (
    <Link
      href={`/events/${event.event_id}`}
      onClick={onOpen}
      className="flex h-full w-56 flex-col rounded-2xl border border-line bg-ink/70 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-paper/25"
    >
      {event.category ? <span className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{event.category}</span> : null}
      <span className="mt-1 line-clamp-2 text-[15px] leading-snug font-medium text-paper">{event.title}</span>
      <span className="mt-2 text-[13px] text-paper/70">{when.format(new Date(event.starts))}</span>
      {event.location ? <span className="truncate text-[13px] text-muted">{event.location}</span> : null}
      <span className={`mt-auto pt-3 text-xs ${scarce ? "text-ember" : "text-muted"}`}>
        {left === null ? "Open to all" : left === 0 ? "Full" : `${left} ${left === 1 ? "spot" : "spots"} left`}
      </span>
    </Link>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-paper"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/** A four-point spark: the assistant's mark. */
function Spark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c.4 4.6 2.4 7.6 7.9 9.1.3.1.3.6 0 .7-5.5 1.5-7.5 4.5-7.9 9.1 0 .4-.6.4-.6 0-.4-4.6-2.4-7.6-7.9-9.1-.3-.1-.3-.6 0-.7 5.5-1.5 7.5-4.5 7.9-9.1 0-.4.6-.4.6 0z" />
    </svg>
  );
}
