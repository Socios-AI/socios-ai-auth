export type AuthErrorCode =
  | "EXPIRED"
  | "INVALID"
  | "MISSING_TOKEN"
  | "API_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "RATE_LIMITED";

export type MfaErrorCode =
  | "INVALID_CODE"
  | "EXPIRED"
  | "RATE_LIMITED"
  | "NO_FACTOR"
  | "API_ERROR";

/**
 * JWT custom claims surfaced by the Sócios AI Identity hook for super-admin
 * gating (admin-web middleware reads `payload.super_admin`).
 *
 * Kept open-ended (index signature) because the access token also carries
 * standard Supabase claims (sub, aal, amr, etc.) that consumers may inspect.
 */
export type SuperAdminClaims = {
  super_admin: boolean;
  [key: string]: unknown;
};

/**
 * JWT custom claims for partners-web middleware. Extends SuperAdminClaims
 * (super_admin still present, may be false for non-super partners) and adds
 * `partner_id` set by the identity hook when the user has an active partner
 * row.
 */
export type PartnerClaims = SuperAdminClaims & {
  partner_id: string | null;
};
