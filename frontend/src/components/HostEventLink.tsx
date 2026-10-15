"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LinkSpinner } from "@/components/LinkSpinner";
import { useViewer } from "@/lib/use-viewer";

const HOSTING_NEW = "/hosting/new";

/**
 * The way in to hosting, for anyone. A host goes straight to the form; a signed-out
 * visitor goes to sign-in and lands on the form afterwards. Nobody is sent to a
 * protected URL only to be bounced off it.
 *
 * The label never changes, so the control does not shift while we work out who is
 * looking: only where it points does.
 */
export function HostEventLink({ className, children }: { className?: string; children: ReactNode }) {
  const viewer = useViewer();
  const href =
    viewer.status === "signed-out" ? `/signin?next=${encodeURIComponent(HOSTING_NEW)}` : HOSTING_NEW;

  return (
    <Link href={href} className={className}>
      {children}
      <LinkSpinner />
    </Link>
  );
}
