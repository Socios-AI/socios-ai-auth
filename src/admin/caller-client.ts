import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CallerClientOptions = {
  url?: string;
  anonKey?: string;
  callerJwt: string;
};

/**
 * Builds a supabase-js client authenticated as the caller (using their JWT)
 * rather than the service role. RLS sees the user's identity, and RPCs that
 * check auth.uid() resolve correctly. Sessions are NOT persisted.
 */
export function getCallerClient(opts: CallerClientOptions): SupabaseClient {
  const url = opts.url ?? process.env.SUPABASE_URL;
  const anonKey = opts.anonKey ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase URL or anon key");
  if (!opts.callerJwt) throw new Error("callerJwt is required");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${opts.callerJwt}` } },
  });
}
