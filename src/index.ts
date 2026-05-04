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
