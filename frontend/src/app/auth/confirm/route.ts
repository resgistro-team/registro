import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, safeNext } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Where links in Supabase's emails land: sign-up confirmation and password reset.
 * Handles both link styles: the default `?code=` and the `?token_hash=&type=`
 * that a customised email template produces.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const expired = NextResponse.redirect(new URL("/signin?notice=link-expired", origin));

  if (!authConfigured) return expired;

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing token") };

  return error ? expired : NextResponse.redirect(new URL(next, origin));
}
