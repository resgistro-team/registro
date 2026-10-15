import type { ReactNode } from "react";

/** Remounts on every move between pages, so each new page eases in. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
