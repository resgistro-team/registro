"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { PASSWORD_MIN, updatePassword, type Failure } from "@/lib/auth";
import { FormAlert, PasswordField, SubmitButton } from "./fields";

/** Reached from the reset email, which signs the visitor in just long enough to do this. */
export function UpdatePasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setFailure(null);
    const result = await updatePassword(password);
    setPending(false);
    if (!result.ok) {
      setFailure(result);
      passwordRef.current?.focus();
      return;
    }
    // The reset link already signed them in, so go straight to the site.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="auth-swap flex flex-col gap-7">
      <header className="flex flex-col gap-2.5">
        <h1 className="font-display text-[clamp(2.1rem,6vw,2.75rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
          Set a new password.
        </h1>
        <p className="text-[0.98rem] leading-relaxed text-paper/70">Pick something you&apos;ll remember this time.</p>
      </header>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {failure && !failure.field ? (
          <FormAlert>
            {failure.message}{" "}
            {failure.action === "reset" ? (
              <Link href="/reset" className="font-semibold underline underline-offset-2">
                Get a new link
              </Link>
            ) : null}
          </FormAlert>
        ) : null}
        <PasswordField
          ref={passwordRef}
          label="New password"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={failure?.field === "password" ? failure.message : undefined}
          required
        />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save password
        </SubmitButton>
      </form>
    </div>
  );
}
