export { validateFromParam, deriveAppName } from "./from-param";
export type { FromValidationResult } from "./from-param";

export { passwordSchema, resetFormSchema } from "./validation";
export type { ResetFormInput } from "./validation";

export { getSupabaseBrowserClient } from "./browser/client";
export type { GetBrowserClientOptions } from "./browser/client";

export { getSupabaseImplicitClient } from "./browser/implicit-client";
export type { GetImplicitClientOptions } from "./browser/implicit-client";

export type { AuthErrorCode, MfaErrorCode, SuperAdminClaims, PartnerClaims } from "./types";

import type { PartnerClaims } from "./types";

/**
 * Returns the `partner_id` claim from a decoded JWT payload, or `null` if the
 * input is null/undefined or `partner_id` is missing/null.
 *
 * Used by partners-web middleware to gate access on `claims.partner_id`.
 */
export function getPartnerIdFromClaims(claims: PartnerClaims | null): string | null {
  return claims?.partner_id ?? null;
}

export type {
  MembershipClaim,
  SubscriptionClaim,
  AppScopedClaims,
} from "./types";

import type {
  AppScopedClaims,
  MembershipClaim,
  SubscriptionClaim,
} from "./types";

/**
 * F0.2 · Returns true if the caller has any non-revoked membership in the
 * given app slug. Use for binary access gates.
 */
export function hasAppAccess(claims: AppScopedClaims | null, appSlug: string): boolean {
  if (!claims?.memberships) return false;
  return claims.memberships.some((m) => m.app_slug === appSlug);
}

/**
 * F0.2 · Returns the first membership matching `appSlug`, or null. Use when
 * you need the role/permissions of a single grant.
 */
export function getAppMembership(claims: AppScopedClaims | null, appSlug: string): MembershipClaim | null {
  if (!claims?.memberships) return null;
  return claims.memberships.find((m) => m.app_slug === appSlug) ?? null;
}

/**
 * F0.2 · Returns all memberships matching `appSlug`. Use when the same user
 * can have multiple grants in the same app (e.g. multiple orgs).
 */
export function getAppMemberships(claims: AppScopedClaims | null, appSlug: string): MembershipClaim[] {
  if (!claims?.memberships) return [];
  return claims.memberships.filter((m) => m.app_slug === appSlug);
}

/**
 * F0.2 · Returns true if the caller has any active subscription covering the
 * given app slug.
 */
export function hasActiveSubscription(claims: AppScopedClaims | null, appSlug: string): boolean {
  if (!claims?.subscriptions) return false;
  return claims.subscriptions.some((s) => s.app_slug === appSlug);
}

/**
 * F0.2 · Returns all active subscriptions covering the given app slug.
 */
export function getActiveSubscriptions(claims: AppScopedClaims | null, appSlug: string): SubscriptionClaim[] {
  if (!claims?.subscriptions) return [];
  return claims.subscriptions.filter((s) => s.app_slug === appSlug);
}

/**
 * F0.2 · Defensive reader for the deploy-window transition. Fail-closed:
 * returns [] if the input shape is legacy (rows without `app_slug`) or
 * malformed. New consumers should prefer `claims.memberships` directly once
 * the migration has fully rolled out and tokens have refreshed.
 */
export function readMembershipsCompat(rawClaims: unknown): MembershipClaim[] {
  if (!rawClaims || typeof rawClaims !== "object") return [];
  const m = (rawClaims as { memberships?: unknown }).memberships;
  if (!Array.isArray(m)) return [];
  if (m.length === 0) return [];
  if (m.every((r) => r && typeof r === "object" && "app_slug" in r)) {
    return m as MembershipClaim[];
  }
  return [];
}
