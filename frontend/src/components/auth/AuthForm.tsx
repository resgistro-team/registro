"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { PASSWORD_MIN, signIn, signUp, type Failure } from "@/lib/auth";
import { safeNext } from "@/lib/supabase/config";
import { Field, FormAlert, PasswordField, SubmitButton } from "./fields";
import { CheckInbox } from "./CheckInbox";

type Mode = "signin" | "signup";

const COPY = {
  signin: {
    title: "Welcome back.",
    lede: "Sign in to see what you're going to.",
    submit: "Sign in",
    pending: "Signing in…",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Are you coming?",
    lede: "Make an account and save your spot at anything happening.",
    submit: "Create account",
    pending: "Creating your account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/signin",
  },
} as const;

/** Messages carried in the URL from elsewhere, such as an expired email link. */
const NOTICES: Record<string, string> = {
  "link-expired": "That link has expired or was already used. Sign in, or ask for a new one.",
  "password-updated": "Password saved. Sign in with your new one.",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const notice = NOTICES[params.get("notice") ?? ""];

  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const withNext = (href: string) => (next === "/" ? href : `${href}?next=${encodeURIComponent(next)}`);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setPending(true);
    setFailure(null);
    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(String(form.get("name") ?? ""), email, password, next);
    setPending(false);

    if (!result.ok) {
      setFailure(result);
      // Put the cursor where the problem is.
      const target = { name: nameRef, email: emailRef, password: passwordRef }[result.field ?? "email"];
      target.current?.focus();
      return;
    }
    if (result.outcome === "check-email") {
      setSentTo(email.trim());
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (sentTo) {
    return <CheckInbox email={sentTo} onBack={() => setSentTo(null)} />;
  }

  const fieldError = (field: NonNullable<Failure["field"]>) => (failure && failure.field === field ? failure.message : undefined);
  const formError = failure && !failure.field ? failure : null;

  return (
    <div key={mode} className="auth-swap flex flex-col gap-7">
      <header className="flex flex-col gap-2.5">
        <h1 className="font-display text-[clamp(2.1rem,6vw,2.75rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
          {copy.title}
        </h1>
        <p className="text-[0.98rem] leading-relaxed text-paper/70">{copy.lede}</p>
      </header>

      {notice && !failure ? (
        <p role="status" className="rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm text-paper/85">
          {notice}
        </p>
      ) : null}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError ? (
          <FormAlert>
            {formError.message}{" "}
            {formError.action === "reset" ? (
              <Link href="/reset" className="font-semibold underline underline-offset-2">
                Reset your password
              </Link>
            ) : null}
          </FormAlert>
        ) : null}

        {mode === "signup" ? (
          <Field
            ref={nameRef}
            label="Your name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Ama Mensah"
            error={fieldError("name")}
            required
          />
        ) : null}

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
          error={fieldError("email")}
          required
        />
        {failure?.field === "email" && failure.action === "sign-in" ? (
          <p className="-mt-3 text-xs text-paper/80">
            <Link href={withNext("/signin")} className="font-semibold underline underline-offset-2">
              Sign in instead
            </Link>
          </p>
        ) : null}

        <PasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? PASSWORD_MIN : undefined}
          hint={mode === "signup" ? `At least ${PASSWORD_MIN} characters.` : undefined}
          error={fieldError("password")}
          aside={
            mode === "signin" ? (
              <Link href="/reset" className="text-xs font-medium text-muted transition-colors hover:text-paper">
                Forgot it?
              </Link>
            ) : null
          }
          required
        />

        <SubmitButton pending={pending} pendingLabel={copy.pending}>
          {copy.submit}
        </SubmitButton>
      </form>

      <p className="text-sm text-paper/65">
        {copy.switchPrompt}{" "}
        <Link href={withNext(copy.switchHref)} className="font-semibold text-paper underline-offset-4 hover:underline">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
