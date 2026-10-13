"use client";

import { useEffect, useRef } from "react";
import { authConfigured } from "@/lib/supabase/config";

/** After sign-up or a reset request: the one thing left to do is open the email. */
export function CheckInbox({
  email,
  onBack,
  reason = "signup",
}: {
  email: string;
  onBack: () => void;
  reason?: "signup" | "reset";
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus here, so screen readers announce the new state.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="auth-swap flex flex-col gap-6">
      <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-ink/60">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-ember">
          <path d="M4 7l8 6 8-6M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <header className="flex flex-col gap-2.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-[clamp(2.1rem,6vw,2.75rem)] leading-[1.02] font-semibold tracking-[-0.03em] outline-none"
        >
          Check your inbox.
        </h1>
        <p className="text-[0.98rem] leading-relaxed text-paper/70">
          We sent a link to <span className="font-semibold break-all text-paper">{email}</span>.{" "}
          {reason === "signup"
            ? "Open it on this device to finish making your account."
            : "Open it on this device to set a new password."}
        </p>
      </header>
      {authConfigured ? null : (
        <p className="rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm text-paper/80">
          Preview mode: no email was actually sent. This is what people will see once accounts are connected.
        </p>
      )}
      <p className="text-sm text-paper/65">
        Not there? Check spam, or{" "}
        <button type="button" onClick={onBack} className="font-semibold text-paper underline-offset-4 hover:underline">
          use a different email
        </button>
        .
      </p>
    </div>
  );
}
