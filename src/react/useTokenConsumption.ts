"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../browser/client";
import type { AuthErrorCode } from "../types";

export type TokenConsumptionState =
  | { state: "consuming" }
  | { state: "ready"; resolvedType: string }
  | { state: "error"; errorCode: AuthErrorCode };

export type UseTokenConsumptionOptions = {
  acceptedTypes: readonly string[];
  source?: "hash" | "query" | "auto";
};

function classifySupabaseError(message: string | undefined): AuthErrorCode {
  if (!message) return "INVALID";
  if (/expired|invalid.*token/i.test(message)) return "EXPIRED";
  return "INVALID";
}

export function useTokenConsumption(opts: UseTokenConsumptionOptions): {
  state: "consuming" | "ready" | "error";
  errorCode?: AuthErrorCode;
  resolvedType?: string;
} {
  const [s, setS] = useState<TokenConsumptionState>({ state: "consuming" });
  const ranRef = useRef(false);
  const source = opts.source ?? "auto";

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function consume() {
      if (typeof window === "undefined") return;
      const supabase = getSupabaseBrowserClient();
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const queryParams = new URLSearchParams(window.location.search);

      const tryHash = source === "hash" || source === "auto";
      const tryQuery = source === "query" || source === "auto";

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      if (tryHash && accessToken && refreshToken && hashType) {
        if (!opts.acceptedTypes.includes(hashType)) {
          setS({ state: "error", errorCode: "INVALID" });
          return;
        }
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          setS({ state: "error", errorCode: classifySupabaseError(error.message) });
          return;
        }
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setS({ state: "ready", resolvedType: hashType });
        return;
      }

      const queryTokenHash = queryParams.get("token_hash");
      const queryType = queryParams.get("type");

      if (tryQuery && queryTokenHash && queryType) {
        if (!opts.acceptedTypes.includes(queryType)) {
          setS({ state: "error", errorCode: "INVALID" });
          return;
        }
        const supabaseType = queryType.endsWith("_new") ? queryType.slice(0, -"_new".length) : queryType;
        const { error } = await supabase.auth.verifyOtp({
          token_hash: queryTokenHash,
          type: supabaseType as "signup" | "email_change" | "recovery" | "invite",
        });
        if (error) {
          setS({ state: "error", errorCode: classifySupabaseError(error.message) });
          return;
        }
        setS({ state: "ready", resolvedType: queryType });
        return;
      }

      // PKCE error redirect (e.g. ?error=access_denied&error_code=otp_expired&...)
      // @supabase/ssr v0.5+ forces flowType="pkce" for browser clients, so we
      // also have to handle that branch here. The error can land in the hash
      // (legacy) or in the query (current PKCE).
      const queryError = queryParams.get("error");
      const hashError = hashParams.get("error");
      const errorParam = queryError ?? hashError;
      if (tryQuery && errorParam) {
        const desc = queryParams.get("error_description") ?? hashParams.get("error_description") ?? errorParam;
        setS({ state: "error", errorCode: classifySupabaseError(desc) });
        return;
      }

      // PKCE success redirect: GoTrue exchanges the pkce_<token> in the email
      // for a one-time auth code and redirects to <redirect_to>?code=<uuid>.
      // We then call exchangeCodeForSession which uses the locally-stored
      // code_verifier to mint a session.
      const queryCode = queryParams.get("code");
      if (tryQuery && queryCode) {
        // Best-effort type inference: prefer ?type= if GoTrue ever adds it,
        // otherwise fall back to the only accepted type for this hook.
        const inferredType = queryParams.get("type") ?? opts.acceptedTypes[0];
        if (!inferredType || !opts.acceptedTypes.includes(inferredType)) {
          setS({ state: "error", errorCode: "INVALID" });
          return;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(queryCode);
        if (error) {
          setS({ state: "error", errorCode: classifySupabaseError(error.message) });
          return;
        }
        // Scrub the auth code from the URL so a refresh doesn't re-attempt
        // and so it doesn't sit visible in history.
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete("code");
        const newSearch = cleanParams.toString() ? `?${cleanParams.toString()}` : "";
        window.history.replaceState(null, "", window.location.pathname + newSearch);
        setS({ state: "ready", resolvedType: inferredType });
        return;
      }

      setS({ state: "error", errorCode: "MISSING_TOKEN" });
    }
    consume();
  }, []);

  return s.state === "ready"
    ? { state: "ready", resolvedType: s.resolvedType }
    : s.state === "error"
      ? { state: "error", errorCode: s.errorCode }
      : { state: "consuming" };
}
