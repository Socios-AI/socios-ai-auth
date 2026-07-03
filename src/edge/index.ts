// @socios-ai/auth/edge
//
// Pure, Edge-safe contract for reading the Sócios AI cross-subdomain SSO session.
// This module MUST NOT import from `next/*` or `@supabase/*`: it has to run
// unchanged in the Next Edge middleware runtime, in Node server code, and in the
// browser. Keep it zero-dependency.
//
// It consolidates what used to be copy-pasted per app: the JWT payload decoder,
// the auth-cookie name derivation, the chunked-cookie reassembly, and the
// @supabase/ssr cookie value parsing.

export type CookieReader = { get(name: string): { value: string } | undefined };

// atob exists in the Edge runtime and browsers; Buffer is the Node fallback.
// For the ASCII claims we read (sub, email, aal, exp, ...) both agree byte for byte.
function base64ToUtf8(b64: string): string {
  if (typeof atob === "function") return atob(b64);
  return Buffer.from(b64, "base64").toString("utf-8");
}

/**
 * Decode a JWT payload WITHOUT verifying the signature. Callers must already
 * trust the source (a session token minted by Supabase).
 *
 * Contract (matches the previous admin/partners implementation):
 *   - fewer than 2 segments / empty / non-base64url payload -> null
 *   - base64url-valid payload that is not JSON -> {} (empty claims)
 *   - valid payload -> parsed object
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  // Only base64url-safe characters are allowed in a real JWT payload segment.
  if (!/^[A-Za-z0-9\-_]*$/.test(payload)) return null;
  // From here the segment "looks like" a payload. Any failure decoding it or
  // parsing JSON collapses to {} (empty claims) so the contract is identical
  // whether base64 decoding throws (atob) or yields garbage (Buffer).
  try {
    const json = base64ToUtf8(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Derive the Supabase auth-cookie base name from the project URL.
 * Fail-closed: returns null when the URL is missing/empty so callers can treat
 * "no cookie name" as "no session" (default-deny) instead of building a bogus
 * `sb--auth-token`. The caller reads the env var at the boundary and passes it in.
 */
export function sessionCookieName(supabaseUrl: string | undefined): string | null {
  const ref = supabaseUrl?.replace(/^https?:\/\//, "").split(".")[0];
  return ref ? `sb-${ref}-auth-token` : null;
}

/**
 * Read the auth cookie value, reassembling @supabase/ssr chunks (`<base>.0`,
 * `<base>.1`, ...) in order. Returns null when neither the base cookie nor any
 * chunk is present.
 */
export function readSessionCookie(cookies: CookieReader, baseName: string): string | null {
  if (cookies.get(`${baseName}.0`)) {
    let assembled = "";
    let i = 0;
    while (true) {
      const c = cookies.get(`${baseName}.${i}`);
      if (!c) break;
      assembled += c.value;
      i++;
    }
    return assembled || null;
  }
  return cookies.get(baseName)?.value ?? null;
}

/**
 * Extract the access token from the auth cookie value. @supabase/ssr stores it
 * in several shapes depending on version:
 *   - JSON Session object `{access_token, refresh_token, user, ...}` (v0.5+)
 *   - JSON array `[access_token, refresh_token, ...]` (legacy)
 *   - either of the above base64-encoded with a `base64-` prefix (default v0.5+)
 *   - a bare access token (test/legacy)
 * Falls back to the raw value when it cannot parse a known shape.
 */
export function extractAccessToken(cookieValue: string): string {
  if (
    !cookieValue.startsWith("{") &&
    !cookieValue.startsWith("[") &&
    !cookieValue.startsWith("base64-")
  ) {
    return cookieValue;
  }
  try {
    const raw = cookieValue.startsWith("base64-")
      ? base64ToUtf8(cookieValue.slice("base64-".length))
      : cookieValue;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      return parsed[0];
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "access_token" in parsed &&
      typeof (parsed as { access_token: unknown }).access_token === "string"
    ) {
      return (parsed as { access_token: string }).access_token;
    }
    return cookieValue;
  } catch {
    return cookieValue;
  }
}
