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
  return (
    <span
      role="status"
      aria-label="Loading"
      className="ml-1.5 inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current align-[-0.15em]"
    />
  );
}
