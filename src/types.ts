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

/**
 * F0.2 · Single membership row in the JWT `memberships` claim.
 * Each row is one (user × app × org × role) grant. Cross-app: the same user
 * may have rows for multiple `app_slug` values · consumer filters by its own
 * app slug.
 */
export type MembershipClaim = {
  app_slug: string;
  org_id: string | null;
  role: string;
  permissions: Record<string, unknown>;
};

/**
 * F0.2 · Single subscription row in the JWT `subscriptions` claim.
 * If a plan covers multiple apps via `plan_apps`, the same subscription
 * appears once per app, each row tagged with its `app_slug`.
 */
export type SubscriptionClaim = {
  app_slug: string;
  plan_slug: string;
  status: "active" | "trialing" | "manual";
  current_period_end: string | null;
  features: Record<string, unknown>;
};

/**
 * F0.2 · Full claim payload as emitted by the Sócios AI Identity hook
 * post-2026-05-05. Use this when a consumer needs the full picture; legacy
 * `SuperAdminClaims` / `PartnerClaims` remain valid open-ended subsets.
 *
 * Note: `claims.app` was dropped in F0.2 · do not reference it.
 */
export type AppScopedClaims = {
  super_admin: boolean;
  tier: string | null;
  partner_id: string | null;
  mfa_enrolled: boolean;
  locale: string;
  memberships: MembershipClaim[];
  subscriptions: SubscriptionClaim[];
  [key: string]: unknown;
};
