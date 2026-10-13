"use client";

import { useCallback, useEffect, useState } from "react";
import { request, type RequestOptions } from "./api";
import { getAccessToken, watchAccount, type Account } from "./auth";

export type Viewer =
  | { status: "loading"; account: undefined }
  | { status: "signed-out"; account: null }
  | { status: "signed-in"; account: Account };

/** Who is looking at the page, for display only. The API decides what they may actually do. */
export function useViewer(): Viewer {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => watchAccount(setAccount), []);
  if (account === undefined) return { status: "loading", account: undefined };
  if (account === null) return { status: "signed-out", account: null };
  return { status: "signed-in", account };
}

/** `request` with the signed-in person's token attached. */
export function useAuthedRequest() {
  return useCallback(async <T,>(path: string, options: Omit<RequestOptions, "token"> = {}) => {
    const token = await getAccessToken();
    return request<T>(path, { ...options, token });
  }, []);
}
