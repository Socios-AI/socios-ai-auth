"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../browser/client";
import type { AuthErrorCode } from "../types";

type AuthApiErrorLike = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

function classify(err: AuthApiErrorLike | null): AuthErrorCode {
  if (!err) return "API_ERROR";
  if (err.code === "invalid_credentials") return "INVALID_CREDENTIALS";
  if (err.code === "email_not_confirmed") return "EMAIL_NOT_CONFIRMED";
  if (err.status === 429) return "RATE_LIMITED";
  return "API_ERROR";
}

export type LoginState = "idle" | "submitting" | "success" | "mfa-required" | "error";

export type UseLoginReturn = {
  state: LoginState;
  errorCode: AuthErrorCode | null;
  mfaRequired: boolean;
  submit: (email: string, password: string) => Promise<void>;
};

export function useLogin(): UseLoginReturn {
  const [state, setState] = useState<LoginState>("idle");
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);

  async function submit(email: string, password: string): Promise<void> {
    setState("submitting");
    setErrorCode(null);
    setMfaRequired(false);

    const sb = getSupabaseBrowserClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setErrorCode(classify(error));
      setState("error");
      return;
    }

    const { data: factors, error: lfErr } = await sb.auth.mfa.listFactors();
    if (lfErr) {
      setErrorCode("API_ERROR");
      setState("error");
      return;
    }

    const verifiedTotp = factors.totp?.find((f: { status: string }) => f.status === "verified");
    if (verifiedTotp) {
      setMfaRequired(true);
      setState("mfa-required");
      return;
    }

    setState("success");
  }

  return { state, errorCode, mfaRequired, submit };
}
