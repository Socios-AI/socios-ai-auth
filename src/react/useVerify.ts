"use client";

import { useEffect, useState } from "react";
import { useTokenConsumption } from "./useTokenConsumption";
import type { AuthErrorCode } from "../types";

export type UseVerifyOptions = {
  onError?: (code: AuthErrorCode) => void;
};

export function useVerify(opts: UseVerifyOptions = {}): {
  state: "verifying" | "success" | "error";
  errorCode?: AuthErrorCode;
  resolvedType?: "signup" | "email_change" | "email_change_new";
} {
  const tc = useTokenConsumption({ acceptedTypes: ["signup", "email_change", "email_change_new"] });
  const [errorFired, setErrorFired] = useState(false);

  useEffect(() => {
    if (tc.state === "error" && tc.errorCode && !errorFired) {
      opts.onError?.(tc.errorCode);
      setErrorFired(true);
    }
  }, [tc.state, tc.errorCode, errorFired, opts]);

  if (tc.state === "consuming") return { state: "verifying" };
  if (tc.state === "error") return { state: "error", errorCode: tc.errorCode };
  return {
    state: "success",
    resolvedType: tc.resolvedType as "signup" | "email_change" | "email_change_new",
  };
}
