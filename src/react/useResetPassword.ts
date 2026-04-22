"use client";

import { useEffect, useState } from "react";
import { useTokenConsumption } from "./useTokenConsumption";
import { getSupabaseBrowserClient } from "../browser/client";
import type { AuthErrorCode } from "../types";

export type UseResetPasswordOptions = {
  onError?: (code: AuthErrorCode) => void;
};

type SubmitState = "idle" | "submitting" | "success" | "lastError";

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
    const supabase = getSupabaseBrowserClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) {
      setSubmit("lastError");
      setSubmitErr("API_ERROR");
      opts.onError?.("API_ERROR");
      return;
    }
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
