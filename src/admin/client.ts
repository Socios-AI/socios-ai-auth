import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type GetAdminClientOptions = {
  url?: string;
  serviceKey?: string;
};

export function getSupabaseAdminClient(opts: GetAdminClientOptions = {}): SupabaseClient {
  const url = opts.url ?? process.env.SUPABASE_URL;
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase URL or service role key");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
