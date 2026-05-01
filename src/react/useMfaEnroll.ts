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

export type MfaEnrollState = "loading" | "ready" | "submitting" | "success" | "error";

export type UseMfaEnrollOptions = {
  /**
   * Friendly name attached to the enrolled TOTP factor. Authenticator
   * apps (iOS Passwords, 1Password, Authy, Google Authenticator) display
   * this label so the user can tell which account a code belongs to.
   * Without it, Supabase falls back to the project ref, which looks
   * like "axyssxqttfnbtawanasf" and confuses users with multiple
   * accounts.
   *
   * Default: "Sócios AI". Pass a per-app value when integrating from
   * a consumer (e.g. "CASE-PREDICTOR") to disambiguate.
   */
  friendlyName?: string;
};

export type UseMfaEnrollReturn = {
  state: MfaEnrollState;
  errorCode: MfaErrorCode | null;
  qrCodeSvg: string | null;
  secret: string | null;
  otpauthUri: string | null;
  submit: (code: string) => Promise<void>;
};

const DEFAULT_FRIENDLY_NAME = "Sócios AI";

export function useMfaEnroll(opts: UseMfaEnrollOptions = {}): UseMfaEnrollReturn {
  const [state, setState] = useState<MfaEnrollState>("loading");
  const [errorCode, setErrorCode] = useState<MfaErrorCode | null>(null);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const factorIdRef = useRef<string | null>(null);
  const enrolledRef = useRef(false);

  useEffect(() => {
    if (enrolledRef.current) return;
    enrolledRef.current = true;
    const sb = getSupabaseBrowserClient();
    sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: opts.friendlyName ?? DEFAULT_FRIENDLY_NAME,
    }).then(({ data, error }) => {
      if (error || !data) {
        setErrorCode(classifyMfaError(error));
        setState("error");
        return;
      }
      factorIdRef.current = data.id;
      setQrCodeSvg(data.totp.qr_code);
      setSecret(data.totp.secret);
      setOtpauthUri(data.totp.uri);
      setState("ready");
    });
  }, []);

  async function submit(code: string): Promise<void> {
    if (!factorIdRef.current) return;
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

  return { state, errorCode, qrCodeSvg, secret, otpauthUri, submit };
}
