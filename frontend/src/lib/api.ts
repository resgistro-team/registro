/**
 * Talks to the Registro API (backend/app.py). Every response follows
 * docs/architecture/DATA_CONTRACT.md, so the types in ./events match it field for field.
 */
import { mockEvents } from "./mock-events";
import type { RegistroEvent } from "./events";

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
/** Without an API the site shows sample events and switches registration off. */
export const apiConfigured = apiUrl !== "";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The API's error codes, in words a person would say. Falls back to the server's own message. */
export function explain(error: unknown): string {
  if (!(error instanceof ApiError)) return "Couldn't reach Registro. Check your connection and try again.";
  switch (error.code) {
    case "EVENT_FULL":
      return "This one's full.";
    case "ALREADY_REGISTERED":
      return "You're already going to this.";
    case "EVENT_ALREADY_STARTED":
      return "This has already started.";
    case "EVENT_NOT_PUBLISHED":
      return "This event isn't open yet.";
    case "EVENT_NOT_FOUND":
      return "That event doesn't exist anymore.";
    case "REGISTRATION_NOT_FOUND":
      return "You weren't registered for this.";
    case "FORBIDDEN":
      return "Only the host can change this event.";
    case "CAPACITY_TOO_SMALL":
      return "More people are already going than that. Set the limit at or above the number going.";
    case "UNAUTHORIZED":
    case "USER_NOT_FOUND":
      return "Your session ran out. Sign in again.";
    default:
      return error.message || "Something went wrong. Try again.";
  }
}

/** True when the only way forward is signing in again, not retrying. */
export function needsSignIn(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "UNAUTHORIZED" || error.code === "USER_NOT_FOUND");
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Supabase access token. Required for anything tied to a person. */
  token?: string | null;
  signal?: AbortSignal;
}

export async function request<T>(path: string, { method = "GET", body, token, signal }: RequestOptions = {}): Promise<T> {
  if (!apiConfigured) throw new ApiError("OFFLINE", "The Registro API isn't connected yet.", 0);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("NETWORK", "Couldn't reach Registro. Check your connection and try again.", 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.code ?? data?.error?.code ?? "UNKNOWN";
    const message = data?.error?.message ?? data?.message ?? "Something went wrong.";
    throw new ApiError(code, message, response.status);
  }
  return data as T;
}

export interface EventFilters {
  query?: string;
  category?: string;
  /** ISO 8601 bounds on the start time: from inclusive, to exclusive. */
  from?: string;
  to?: string;
}

/** Upcoming published events. Uses sample rows when no API is configured. */
export async function listEvents(filters: EventFilters = {}): Promise<{ events: RegistroEvent[]; sample: boolean }> {
  if (!apiConfigured) {
    const q = filters.query?.trim().toLowerCase();
    const events = mockEvents().filter(
      (e) =>
        (!q || `${e.title} ${e.description} ${e.location}`.toLowerCase().includes(q)) &&
        (!filters.category || e.category === filters.category) &&
        (!filters.from || e.start_datetime >= filters.from) &&
        (!filters.to || e.start_datetime < filters.to),
    );
    return { events, sample: true };
  }
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set("query", filters.query.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("date_from", filters.from);
  if (filters.to) params.set("date_to", filters.to);
  const suffix = params.size ? `?${params}` : "";
  return { events: await request<RegistroEvent[]>(`/api/events${suffix}`), sample: false };
}

/** One published event, or null if it doesn't exist or isn't public. */
export async function getEvent(id: string): Promise<{ event: RegistroEvent | null; sample: boolean }> {
  if (!apiConfigured) return { event: mockEvents().find((e) => e.event_id === id) ?? null, sample: true };
  try {
    return { event: await request<RegistroEvent>(`/api/events/${encodeURIComponent(id)}`), sample: false };
  } catch (error) {
    if (error instanceof ApiError && ["EVENT_NOT_FOUND", "EVENT_NOT_PUBLISHED", "INVALID_INPUT"].includes(error.code)) {
      return { event: null, sample: false };
    }
    throw error;
  }
}
