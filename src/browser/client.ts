import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CookieOptions = {
  domain?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

export type GetBrowserClientOptions = {
  url?: string;
  anonKey?: string;
  cookieOptions?: CookieOptions;
};

function readCookieOptionsFromEnv(): CookieOptions | undefined {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (!domain) return undefined;
  const opts: CookieOptions = { domain };
  const sameSite = process.env.NEXT_PUBLIC_COOKIE_SAMESITE;
  if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
    opts.sameSite = sameSite;
  }
  const secure = process.env.NEXT_PUBLIC_COOKIE_SECURE;
  if (secure === "true") opts.secure = true;
  if (secure === "false") opts.secure = false;
  return opts;
}

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

  const cookieOptions = opts.cookieOptions ?? readCookieOptionsFromEnv();
  // Use the implicit flow rather than PKCE so that email-based recovery,
  // invite, and confirmation links work cross-browser. PKCE binds the
  // verifier to the browser that originated the request, which breaks the
  // common case of a user requesting reset on one device and clicking the
  // email on another. We don't use OAuth, so the trade-off is minor; the
  // recovery / signup tokens remain single-use and short-TTL on the server.
  const auth = { flowType: "implicit" as const };
  if (cookieOptions) {
    return createBrowserClient(url, anonKey, { cookieOptions, auth });
  }
  return createBrowserClient(url, anonKey, { auth });
}
