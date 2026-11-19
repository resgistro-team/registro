"use client";

/**
 * What the signed-in person is going to, shared by every part of the page that cares: the wall
 * marks those events, the home page shows the next one. Fetched once, refreshed after a change.
 */
import { useEffect, useSyncExternalStore } from "react";
import { apiConfigured, request } from "./api";
import { getAccessToken } from "./auth";
import type { MyEventItem, MyEvents } from "./events";

export type Plans = { status: "unknown" } | { status: "ready"; going: Set<string>; upcoming: MyEventItem[] };

const UNKNOWN: Plans = { status: "unknown" };
let plans: Plans = UNKNOWN;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  if (loading || !apiConfigured) return;
  loading = (async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        plans = UNKNOWN;
        return;
      }
      const mine = await request<MyEvents>("/api/users/my-events", { token });
      const upcoming = mine.upcoming
        .filter((item) => item.registration.registration_status === "Registered" && item.event.status !== "Cancelled")
        .sort((a, b) => a.event.start_datetime.localeCompare(b.event.start_datetime));
      plans = { status: "ready", going: new Set(upcoming.map((item) => item.event.event_id)), upcoming };
    } catch {
      plans = UNKNOWN;
    } finally {
      // Not signed in yet, or the request failed: try again next time someone asks.
      if (plans === UNKNOWN) loading = null;
      listeners.forEach((listener) => listener());
    }
  })();
}

/** Call after registering or cancelling, so every mark on the page follows. */
export function refreshMyPlans() {
  loading = null;
  load();
}

export function useMyPlans(signedIn: boolean): Plans {
  const current = useSyncExternalStore(subscribe, () => plans, () => UNKNOWN);
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn]);
  return signedIn ? current : UNKNOWN;
}
