import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GetBrowserClientOptions = {
  url?: string;
  anonKey?: string;
};

export function getSupabaseBrowserClient(opts: GetBrowserClientOptions = {}): SupabaseClient {
  const url =
    opts.url ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const anonKey =
    opts.anonKey ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon key");
  }

  return createBrowserClient(url, anonKey);
}
