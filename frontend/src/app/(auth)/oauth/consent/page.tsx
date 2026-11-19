import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LightsLoading } from "@/components/LightsLoading";
import { Notice, primaryButton, quietButton } from "@/components/Notice";
import { authConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connect an assistant · Registro" };

/** What a connected assistant can do, in the words of the Registro MCP server's tools. */
const CAN = [
  "Find events and read their details",
  "See the events you're registered for",
  "Register you for events, and cancel, when you ask it to",
];

/**
 * Where an AI assistant (Claude, ChatGPT…) sends you to connect Registro. You're already signed
 * in by the time you land here (the proxy sees to that); this asks one question: allow it?
 */
export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <Suspense fallback={<LightsLoading label="Loading the request" />}>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}

async function Consent({ searchParams }: Pick<PageProps<"/oauth/consent">, "searchParams">) {
  const { authorization_id } = await searchParams;
  const authorizationId = typeof authorization_id === "string" ? authorization_id : "";

  if (!authConfigured) {
    return <Notice title="Accounts aren't connected yet.">Assistants can connect once Registro accounts are live.</Notice>;
  }
  if (!authorizationId) {
    return <Notice title="This link is incomplete.">Start connecting Registro again from your assistant.</Notice>;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return (
      <Notice title="This request has expired.">
        Start connecting Registro again from your assistant. Requests only last a few minutes.
      </Notice>
    );
  }
  // Already allowed before: go straight back to the assistant.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const app = data.client.name || "An assistant";
  const returnsTo = hostOf(data.redirect_uri);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
          Let {app} use Registro?
        </h1>
        <p className="text-[0.95rem] text-paper/70">
          Signed in as <span className="font-semibold break-all text-paper">{data.user.email}</span>.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-paper/85">It will be able to:</p>
        <ul className="flex flex-col gap-2.5 text-[0.95rem] text-paper/80">
          {CAN.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-paper/50" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <form action="/oauth/decision" method="post" className="flex flex-col gap-3">
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <button type="submit" name="decision" value="approve" className={primaryButton}>
          Allow
        </button>
        <button type="submit" name="decision" value="deny" className={quietButton}>
          Don&apos;t allow
        </button>
      </form>

      <p className="text-xs leading-relaxed text-muted">
        {returnsTo ? <>You&apos;ll go back to {returnsTo}. </> : null}
        Only allow assistants you trust. You can disconnect Registro from the assistant&apos;s settings at any time.
      </p>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
