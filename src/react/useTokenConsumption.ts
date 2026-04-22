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
