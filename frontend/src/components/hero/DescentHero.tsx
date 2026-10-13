"use client";

import { useEffect, useRef, useState } from "react";
import type { DescentHandle } from "./descent-scene";
import { Typewriter } from "./Typewriter";

/**
 * loading: assets are on their way. The name is plain text, so the page is complete already.
 * live:    the WebGL scene is running and draws the name in lights instead.
 * static:  no WebGL. The name stays plain text.
 */
type Mode = "loading" | "live" | "static";

const SEEN_KEY = "registro.descent.seen";

/** The first line is the slogan. The rest take turns once the name has formed. */
const LINES = [
  "Everything happening.",
  "Are you coming?",
  "Why you indoors?",
  "Touch grass.",
  "Too much outside to be inside.",
] as const;

function hasSeen() {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private windows may refuse storage. The dive simply plays again next visit.
  }
}

export function DescentHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const handleRef = useRef<DescentHandle | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const wordmark = wordmarkRef.current;
    if (!section || !canvas || !wordmark) return;

    let cancelled = false;
    // Someone who started scrolling before the scene was ready should not have it play under them.
    let movedOn = false;
    let handle: DescentHandle | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // ?heroT=3.2 holds the dive at that second, for screenshots and tuning.
    const frozenAt = new URLSearchParams(window.location.search).get("heroT");

    (async () => {
      try {
        // Loaded on demand, so three.js stays out of the first bundle.
        const { createDescent } = await import("./descent-scene");
        await document.fonts.ready;
        const created = await createDescent({
          canvas,
          wordmark,
          assetBase: "/hero",
          reducedMotion,
          onSettled: () => {
            markSeen();
            setSettled(true);
          },
          onContextLost: () => setMode("static"),
        });
        if (cancelled) {
          created.dispose();
          return;
        }
        handle = created;
        handleRef.current = created;
        setMode("live");
        if (frozenAt !== null) created.freeze(Number(frozenAt) || 0);
        else if (reducedMotion || movedOn || hasSeen()) created.showEnd();
        else created.play();
      } catch {
        if (!cancelled) setMode("static");
      }
    })();

    // Anyone already scrolling or typing wants the page, so the dive gets out of the way.
    const skip = () => {
      movedOn = true;
      handle?.skip();
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "End", " "].includes(event.key)) skip();
    };
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });
    window.addEventListener("scroll", skip, { passive: true });
    window.addEventListener("keydown", onKey);

    const onMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      handle?.pointer(event.clientX - box.left, event.clientY - box.top);
    };
    const onLeave = () => handle?.pointerOut();
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);

    let resizeTimer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => handle?.relayout(), 120);
    });
    observer.observe(section);

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      window.removeEventListener("scroll", skip);
      window.removeEventListener("keydown", onKey);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      handle?.dispose();
      handleRef.current = null;
    };
  }, []);

  const replay = () => {
    setSettled(false);
    handleRef.current?.play();
  };

  return (
    <section
      ref={sectionRef}
      data-mode={mode}
      data-settled={settled}
      className="group relative isolate flex min-h-svh flex-col justify-center overflow-hidden bg-space"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full opacity-0 transition-opacity duration-700 group-data-[mode=live]:opacity-100"
      />

      {/* The night sky dissolves into the page instead of ending at an edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-linear-to-b from-transparent to-ink"
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-5 px-6 sm:px-10 lg:px-16">
        <h1
          ref={wordmarkRef}
          className="font-display text-[clamp(3.5rem,12vw,8.5rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-paper transition-colors duration-500 group-data-[mode=live]:text-transparent"
        >
          Registro
        </h1>
        <Typewriter
          lines={LINES}
          active={settled || mode === "static"}
          className="min-h-[1.4em] text-[clamp(1.05rem,2.2vw,1.45rem)] leading-snug text-paper/85"
        />
        <a
          href="#events"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3.5 text-[0.95rem] font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
        >
          See what&apos;s on
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {mode === "live" && settled ? (
        <button
          type="button"
          onClick={replay}
          className="absolute right-5 bottom-5 rounded-full border border-paper/25 bg-ink/40 px-3.5 py-1.5 text-xs font-medium text-paper/80 backdrop-blur-sm transition-colors hover:border-paper/60 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
        >
          Replay
        </button>
      ) : null}

    </section>
  );
}
