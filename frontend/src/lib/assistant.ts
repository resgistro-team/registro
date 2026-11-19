/**
 * Ask Registro: talks to the API's /api/assistant, which streams one JSON event per line
 * (see backend/routes/assistant.py).
 */
import { ApiError, apiConfigured, apiUrl } from "./api";

export interface FoundEvent {
  event_id: string;
  title: string;
  category: string | null;
  starts: string;
  ends: string;
  location: string | null;
  spots_left: number | null;
  going: number;
}

export type AssistantEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "events"; events: FoundEvent[] }
  | { type: "error"; message: string }
  | { type: "done" };

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** Sends the conversation and calls `onEvent` for each event as it arrives. */
export async function askRegistro(
  turns: Turn[],
  token: string,
  onEvent: (event: AssistantEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!apiConfigured) throw new ApiError("OFFLINE", "The Registro API isn't connected yet.", 0);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: turns, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("NETWORK", "Couldn't reach Registro. Check your connection and try again.", 0);
  }

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.code ?? "UNKNOWN", data?.message ?? "Something went wrong. Try again.", response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as AssistantEvent);
      } catch {
        // A malformed line is skipped rather than ending the answer.
      }
    }
  }
}

/** What the assistant is doing while a tool runs, in the words the panel shows. */
export function toolStatus(name: string): string {
  switch (name) {
    case "search_events":
      return "Searching events";
    case "list_upcoming_events":
      return "Checking what's coming up";
    case "get_event_details":
      return "Reading the details";
    case "list_my_events":
      return "Checking your events";
    case "register_for_event":
      return "Saving your spot";
    case "cancel_registration":
      return "Cancelling your spot";
    default:
      return "Working on it";
  }
}
