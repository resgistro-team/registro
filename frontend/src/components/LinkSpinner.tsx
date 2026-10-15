"use client";

import { useLinkStatus } from "next/link";

/**
 * Shows up inside a Link while the next page is on its way, so a slow change
 * does not read as a dead click. Nothing renders until the navigation starts,
 * so the control keeps its resting size.
 */
export function LinkSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  // The same activity indicator as every other loading state, at text size.
  return (
    <span role="status" aria-label="Loading" className="spinner spinner-inline ml-1.5 align-[-0.15em]">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${(i - 8) * 0.1}s` }} />
      ))}
    </span>
  );
}
