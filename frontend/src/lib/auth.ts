"use client";

import { AuthError } from "@supabase/supabase-js";
import { authConfigured } from "./supabase/config";
import { createClient } from "./supabase/client";

/**
 * One front door for sign-in, sign-up and password resets.
 * With Supabase keys set it talks to Supabase Auth. Without them it runs a
 * preview that behaves the same way but saves nothing, so the screens can be
 * built and shown before the project is connected.
 */

export const PASSWORD_MIN = 8;

export type Failure = {
  ok: false;
  message: string;
  /** Which field the message is about, so it can be shown and focused there. */
  field?: "name" | "email" | "password";
  /** A follow-up the screen can offer, such as switching to sign-in. */
  action?: "sign-in" | "reset";
};
export type Result<T extends string = "done"> = { ok: true; outcome: T } | Failure;

export interface Account {
  name: string;
  email: string;
}

const fail = (message: string, extra: Omit<Failure, "ok" | "message"> = {}): Failure => ({
  ok: false,
  message,
  ...extra,
});

/** Supabase's error codes, in words a person would say. */
function explain(error: unknown): Failure {
  const code = error instanceof AuthError ? error.code : undefined;
  switch (code) {
    case "invalid_credentials":
      return fail("That email and password don't match.", { action: "reset" });
    case "user_already_exists":
    case "email_exists":
      return fail("There's already an account with that email.", { field: "email", action: "sign-in" });
    case "weak_password":
      return fail(`Pick a stronger password, at least ${PASSWORD_MIN} characters.`, { field: "password" });
    case "email_not_confirmed":
      return fail("Confirm your email first. Check your inbox for the link.");
    case "email_address_invalid":
      return fail("That email doesn't look right.", { field: "email" });
    case "same_password":
      return fail("That's your current password. Pick a new one.", { field: "password" });
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return fail("Too many tries. Give it a minute, then try again.");
    case "signup_disabled":
      return fail("Sign-ups are closed right now.");
    default:
      return fail("Couldn't reach Registro. Check your connection and try again.");
  }
}

/** Checks that need no server, so mistakes show instantly. */
export function checkEmail(email: string): Failure | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : fail("That email doesn't look right.", { field: "email" });
}

export function checkPassword(password: string): Failure | null {
  return password.length >= PASSWORD_MIN
    ? null
    : fail(`Use at least ${PASSWORD_MIN} characters.`, { field: "password" });
}

function siteUrl(path: string) {
  return `${window.location.origin}${path}`;
}

// Preview mode keeps a pretend session in this browser only.
const PREVIEW_KEY = "registro.preview.account";
const PREVIEW_EVENT = "registro:preview-account";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readPreview(): Account | null {
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

function writePreview(account: Account | null) {
  try {
    if (account) window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(account));
    else window.localStorage.removeItem(PREVIEW_KEY);
  } catch {
    // Storage can be blocked. The preview just won't remember the visitor.
  }
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const word = local.split(/[._-]/)[0] ?? local;
  return word ? word[0].toUpperCase() + word.slice(1) : "there";
}

export async function signIn(email: string, password: string): Promise<Result> {
  const invalid = checkEmail(email);
  if (invalid) return invalid;
  if (!password) return fail("Enter your password.", { field: "password" });

  if (!authConfigured) {
    await wait(650);
    // Lets anyone demo the wrong-password message.
    if (password === "wrong-password") return explain(new AuthError("", 400, "invalid_credentials"));
    writePreview({ name: nameFromEmail(email), email: email.trim() });
    return { ok: true, outcome: "done" };
  }

  try {
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    return error ? explain(error) : { ok: true, outcome: "done" };
  } catch (error) {
    return explain(error);
  }
}

/** "signed-in" when the project skips email confirmation, otherwise "check-email". */
export async function signUp(
  name: string,
  email: string,
  password: string,
  next: string,
): Promise<Result<"signed-in" | "check-email">> {
  if (!name.trim()) return fail("What should we call you?", { field: "name" });
  const invalid = checkEmail(email) ?? checkPassword(password);
  if (invalid) return invalid;

  if (!authConfigured) {
    await wait(800);
    if (email.trim().toLowerCase().startsWith("taken@")) {
      return explain(new AuthError("", 422, "user_already_exists"));
    }
    // Preview sends no email, so it behaves like a project with email confirmation off: straight in.
    writePreview({ name: name.trim().split(" ")[0], email: email.trim() });
    return { ok: true, outcome: "signed-in" };
  }

  try {
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        // The backend reads this to create the Registro profile (get_or_create_user).
        data: { full_name: name.trim() },
        emailRedirectTo: siteUrl(`/auth/confirm?next=${encodeURIComponent(next)}`),
      },
    });
    if (error) return explain(error);
    return { ok: true, outcome: data.session ? "signed-in" : "check-email" };
  } catch (error) {
    return explain(error);
  }
}

export async function sendReset(email: string): Promise<Result> {
  const invalid = checkEmail(email);
  if (invalid) return invalid;

  if (!authConfigured) {
    await wait(650);
    return { ok: true, outcome: "done" };
  }

  try {
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: siteUrl("/auth/confirm?next=/update-password"),
    });
    return error ? explain(error) : { ok: true, outcome: "done" };
  } catch (error) {
    return explain(error);
  }
}

export async function updatePassword(password: string): Promise<Result> {
  const invalid = checkPassword(password);
  if (invalid) return invalid;

  if (!authConfigured) {
    await wait(650);
    return { ok: true, outcome: "done" };
  }

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return fail("This reset link has expired. Ask for a new one.", { action: "reset" });
    const { error } = await supabase.auth.updateUser({ password });
    return error ? explain(error) : { ok: true, outcome: "done" };
  } catch (error) {
    return explain(error);
  }
}

/** The current Supabase access token, for calls to the Registro API. Null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (!authConfigured) return null;
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut() {
  if (!authConfigured) {
    writePreview(null);
    return;
  }
  await createClient().auth.signOut();
}

/**
 * Who is signed in, for display only. Never use this to decide what someone may do:
 * the server verifies the session for that.
 */
export function watchAccount(onChange: (account: Account | null) => void): () => void {
  if (!authConfigured) {
    const emit = () => onChange(readPreview());
    emit();
    window.addEventListener(PREVIEW_EVENT, emit);
    window.addEventListener("storage", emit);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, emit);
      window.removeEventListener("storage", emit);
    };
  }

  const supabase = createClient();
  const toAccount = (user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) =>
    user
      ? {
          name: String(user.user_metadata?.full_name ?? "").split(" ")[0] || nameFromEmail(user.email ?? ""),
          email: user.email ?? "",
        }
      : null;
  supabase.auth.getSession().then(({ data }) => onChange(toAccount(data.session?.user)));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(toAccount(session?.user)));
  return () => data.subscription.unsubscribe();
}
