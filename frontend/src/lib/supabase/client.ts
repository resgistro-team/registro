import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./config";

/** Browser client. Only call when `authConfigured` is true. */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
