"use client";

import { useEffect, useState } from "react";
import { useTokenConsumption } from "./useTokenConsumption";
import { getSupabaseBrowserClient } from "../browser/client";
import type { AuthErrorCode } from "../types";

export type UseResetPasswordOptions = {
  onError?: (code: AuthErrorCode) => void;
  // Path to the host app's password reset endpoint. Defaults to
  // "/api/auth/reset-password". The endpoint must accept POST { password }
  // and trust the cookie session to identify the user. This indirection
  // exists because Supabase MFA enforcement makes auth.updateUser require
  // AAL2, which the recovery flow cannot satisfy — the host app rotates
  // the password via the admin API instead.
  resetEndpoint?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "lastError";

const DEFAULT_RESET_ENDPOINT = "/api/auth/reset-password";

export function useResetPassword(opts: UseResetPasswordOptions = {}): {
  state: "initial" | "ready" | "submitting" | "success" | "error";
  errorCode?: AuthErrorCode;
  submit: (newPassword: string) => Promise<void>;
} {
  const tc = useTokenConsumption({ acceptedTypes: ["recovery"] });
  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [submitErr, setSubmitErr] = useState<AuthErrorCode | undefined>();
  const [errorFired, setErrorFired] = useState(false);

  useEffect(() => {
    if (tc.state === "error" && tc.errorCode && !errorFired) {
      opts.onError?.(tc.errorCode);
      setErrorFired(true);
    }
  }, [tc.state, tc.errorCode, errorFired, opts]);

  async function doSubmit(newPassword: string): Promise<void> {
    setSubmit("submitting");
    setSubmitErr(undefined);
    const endpoint = opts.resetEndpoint ?? DEFAULT_RESET_ENDPOINT;
    let ok = false;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
        credentials: "same-origin",
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setSubmit("lastError");
      setSubmitErr("API_ERROR");
      opts.onError?.("API_ERROR");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSubmit("success");
  }

  if (tc.state === "consuming") return { state: "initial", submit: doSubmit };
  if (tc.state === "error") return { state: "error", errorCode: tc.errorCode, submit: doSubmit };
  // tc.state === "ready"
  if (submit === "submitting") return { state: "submitting", submit: doSubmit };
  if (submit === "success") return { state: "success", submit: doSubmit };
  if (submit === "lastError") return { state: "ready", errorCode: submitErr, submit: doSubmit };
  return { state: "ready", submit: doSubmit };
}
