"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../browser/client";

type GateState = {
  isSuper: boolean;
  canImpersonate: boolean;
  needsMfaChallenge: boolean;
};

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    const payload = parts[1];
    if (!payload) return null;
    const decoded = typeof atob === "function"
      ? atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
      : Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function compute(token: string | null): GateState {
  if (!token) return { isSuper: false, canImpersonate: false, needsMfaChallenge: false };
  const claims = decodeJwt(token);
  if (!claims) return { isSuper: false, canImpersonate: false, needsMfaChallenge: false };
  const isSuper = claims["is_super_admin"] === true;
  const amr = Array.isArray(claims["amr"]) ? (claims["amr"] as Array<{ method?: string }>) : [];
  const hasTotp = amr.some((entry) => entry?.method === "totp");
  return {
    isSuper,
    canImpersonate: isSuper && hasTotp,
    needsMfaChallenge: isSuper && !hasTotp,
  };
}

export type UseImpersonationGateReturn = GateState & {
  refresh: () => Promise<void>;
};

export function useImpersonationGate(): UseImpersonationGateReturn {
  const [gate, setGate] = useState<GateState>({ isSuper: false, canImpersonate: false, needsMfaChallenge: false });

  const refresh = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    const { data } = await sb.auth.getSession();
    setGate(compute(data?.session?.access_token ?? null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...gate, refresh };
}
