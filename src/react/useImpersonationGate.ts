"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../browser/client";
import { decodeJwtPayload } from "../edge/index";

type GateState = {
  isSuper: boolean;
  canImpersonate: boolean;
  needsMfaChallenge: boolean;
};

function compute(token: string | null): GateState {
  if (!token) return { isSuper: false, canImpersonate: false, needsMfaChallenge: false };
  const claims = decodeJwtPayload<Record<string, unknown>>(token);
  if (!claims) return { isSuper: false, canImpersonate: false, needsMfaChallenge: false };
  // The custom access token hook emits the claim as `super_admin`
  // (see identity migration 20260510000001). Reading `is_super_admin`
  // here made this gate permanently false in production.
  const isSuper = claims["super_admin"] === true;
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
