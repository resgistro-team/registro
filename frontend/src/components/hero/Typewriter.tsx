"use client";

import { useEffect, useState } from "react";

/** Milliseconds. Deleting runs faster than typing, the way a person clears a line. */
const PACE = { type: 46, erase: 22, hold: 2600, gap: 380 };

interface TypewriterProps {
  /** The first line is the one shown at rest and read out by screen readers. */
  lines: readonly string[];
  /** Stays on the first line until this turns true. */
  active: boolean;
  className?: string;
}

/**
 * Types each line, holds it, clears it, and moves to the next, forever.
 * Visitors who asked for less motion keep the first line and nothing moves.
 */
export function Typewriter({ lines, active, className }: TypewriterProps) {
  const [text, setText] = useState(lines[0] ?? "");

  useEffect(() => {
    if (!active || lines.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let line = 0;
    let shown = lines[0].length;
    let erasing = true;
    let timer = 0;

    const step = () => {
      const current = lines[line];
      if (erasing) {
        shown -= 1;
        setText(current.slice(0, shown));
        if (shown === 0) {
          erasing = false;
          line = (line + 1) % lines.length;
          timer = window.setTimeout(step, PACE.gap);
        } else {
          timer = window.setTimeout(step, PACE.erase);
        }
        return;
      }
      shown += 1;
      setText(current.slice(0, shown));
      if (shown === current.length) {
        erasing = true;
        timer = window.setTimeout(step, PACE.hold);
      } else {
        timer = window.setTimeout(step, PACE.type);
      }
    };

    // The opening line gets its full hold before anything is erased.
    timer = window.setTimeout(step, PACE.hold);
    return () => window.clearTimeout(timer);
  }, [active, lines]);

  return (
    <p className={className}>
      <span className="sr-only">{lines[0]}</span>
      <span aria-hidden="true">
        {text}
        {active ? <span className="typewriter-caret" /> : null}
      </span>
    </p>
  );
}
