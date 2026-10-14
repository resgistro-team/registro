/**
 * Supabase Auth settings. Both values are public by design.
 * Until they are set, the sign-in screens run in preview mode and save nothing.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authConfigured = supabaseUrl !== "" && supabaseKey !== "";

/**
 * Only allow redirects to paths on this site. A crafted link such as
 * `?next=//evil.example` would otherwise send a freshly signed-in visitor elsewhere.
 */
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
