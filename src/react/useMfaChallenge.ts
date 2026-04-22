"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../browser/client";
import type { MfaErrorCode } from "../types";

function classifyMfaError(err: { message?: string; status?: number } | null): MfaErrorCode {
  if (!err) return "API_ERROR";
  if (err.status === 429) return "RATE_LIMITED";
  if (err.message && /invalid.*(otp|code)/i.test(err.message)) return "INVALID_CODE";
  if (err.message && /expired/i.test(err.message)) return "EXPIRED";
  return "API_ERROR";
}

export type MfaChallengeState = "ready" | "submitting" | "success" | "error";

export type UseMfaChallengeReturn = {
  state: MfaChallengeState;
  errorCode: MfaErrorCode | null;
  submit: (code: string) => Promise<void>;
};

export function useMfaChallenge(): UseMfaChallengeReturn {
  const [state, setState] = useState<MfaChallengeState>("ready");
  const [errorCode, setErrorCode] = useState<MfaErrorCode | null>(null);
  const factorIdRef = useRef<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const sb = getSupabaseBrowserClient();
    sb.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) {
        setErrorCode("API_ERROR");
        setState("error");
        return;
      }
      const verified = data?.totp?.find((f: { status: string }) => f.status === "verified");
      if (!verified) {
        setErrorCode("NO_FACTOR");
        setState("error");
        return;
      }
      factorIdRef.current = verified.id;
      setState("ready");
    });
  }, []);

  async function submit(code: string): Promise<void> {
    if (!factorIdRef.current || state === "error") return;
    setState("submitting");
    setErrorCode(null);
    const sb = getSupabaseBrowserClient();
    const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId: factorIdRef.current });
    if (chErr || !ch) {
      setErrorCode(classifyMfaError(chErr));
      setState("error");
      return;
    }
    const { error: vErr } = await sb.auth.mfa.verify({
      factorId: factorIdRef.current,
      challengeId: ch.id,
      code,
    });
    if (vErr) {
      setErrorCode(classifyMfaError(vErr));
      setState("error");
      return;
    }
    setState("success");
  }

  return { state, errorCode, submit };
}
