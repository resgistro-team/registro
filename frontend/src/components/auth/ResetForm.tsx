"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { sendReset, type Failure } from "@/lib/auth";
import { CheckInbox } from "./CheckInbox";
import { Field, FormAlert, SubmitButton } from "./fields";

export function ResetForm() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setFailure(null);
    const result = await sendReset(email);
    setPending(false);
    if (!result.ok) {
      setFailure(result);
      emailRef.current?.focus();
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) return <CheckInbox email={sentTo} reason="reset" onBack={() => setSentTo(null)} />;

  return (
    <div className="auth-swap flex flex-col gap-7">
      <header className="flex flex-col gap-2.5">
        <h1 className="font-display text-[clamp(2.1rem,6vw,2.75rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
          Forgot your password?
        </h1>
        <p className="text-[0.98rem] leading-relaxed text-paper/70">
          Happens. Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </header>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {failure && !failure.field ? <FormAlert>{failure.message}</FormAlert> : null}
        <Field
          ref={emailRef}
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          error={failure?.field === "email" ? failure.message : undefined}
          required
        />
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send me a link
        </SubmitButton>
      </form>

      <p className="text-sm text-paper/65">
        Remembered it?{" "}
        <Link href="/signin" className="font-semibold text-paper underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
