import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GetImplicitClientOptions = {
  url?: string;
  anonKey?: string;
};

// Implicit-flow Supabase client used ONLY for issuing email recovery / invite
// requests. PKCE binds the code verifier to the originating browser context,
// which breaks the common cross-device case (request reset on desktop, click
// email on phone) — exchangeCodeForSession returns 400 because the verifier
// is missing in the second context.
//
// @supabase/ssr v0.5+ hard-codes flowType="pkce" on createBrowserClient and
// silently ignores user-supplied auth options, so we cannot fix this from
// getSupabaseBrowserClient. This helper bypasses @supabase/ssr entirely and
// uses the underlying @supabase/supabase-js createClient with explicit
// flowType="implicit". The resulting recovery email link is a hashed_token
// (non-PKCE) URL; when the user clicks it, GoTrue redirects with
// #access_token=&refresh_token= in the fragment, which useTokenConsumption
// already handles via the regular browser client (setSession).
//
// This client is one-shot: persistSession / autoRefreshToken /
// detectSessionInUrl are all disabled. It exists solely to send the request.
export function getSupabaseImplicitClient(
  opts: GetImplicitClientOptions = {},
): SupabaseClient {
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

  return createClient(url, anonKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
