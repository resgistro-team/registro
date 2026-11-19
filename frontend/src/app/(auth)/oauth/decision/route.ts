import { NextResponse, type NextRequest } from "next/server";
import { authConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * The consent screen's answer. Supabase records it and hands back where to send the person:
 * to the assistant with a sign-in code if they allowed it, or with "access denied" if not.
 */
export async function POST(request: NextRequest) {
  // Only Registro's own consent page may answer. Another site posting "approve" for a signed-in
  // visitor would hand that site's assistant their account.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  }

  const form = await request.formData();
  const authorizationId = String(form.get("authorization_id") ?? "");
  const approve = form.get("decision") === "approve";

  if (!authConfigured || !authorizationId) {
    return NextResponse.redirect(new URL("/oauth/consent", request.url), 303);
  }

  const supabase = await createClient();
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (error || !data) {
    // Expired or already answered: the consent page explains and offers a way forward.
    const retry = new URL("/oauth/consent", request.url);
    retry.searchParams.set("authorization_id", authorizationId);
    return NextResponse.redirect(retry, 303);
  }
  // 303 so the browser follows with a GET, not a second POST to the assistant.
  return NextResponse.redirect(data.redirect_url, 303);
}
