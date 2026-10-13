import type { ReactNode } from "react";

/** A page-level state: empty, failed, or not connected. Says what is true and offers one next step. */
export function Notice({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex max-w-[36rem] flex-col gap-3 border-t border-line py-8">
      <p className="font-display text-2xl font-semibold tracking-tight">{title}</p>
      {children ? <div className="text-[0.98rem] leading-relaxed text-paper/70">{children}</div> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export const linkClass = "font-semibold text-paper underline-offset-4 hover:underline";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-paper px-6 py-3 text-[0.95rem] font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

export const quietButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-paper/85 transition-colors hover:border-paper/50 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:cursor-not-allowed disabled:opacity-50";
