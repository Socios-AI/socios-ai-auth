# Changelog

## v0.2.1 · 2026-04-22

### Bug fixes

- `getSupabaseBrowserClient`: when `opts.cookieOptions` is not provided, the function now falls back to reading `NEXT_PUBLIC_COOKIE_DOMAIN`, `NEXT_PUBLIC_COOKIE_SAMESITE`, `NEXT_PUBLIC_COOKIE_SECURE` environment variables. This is required so that the package's internal calls (from `useLogin`, `useResetPassword`, etc.) and the consumer's app share the same cookie configuration. Without this, login from the package would set cookies in one scope while the consumer reads from another, breaking SSO.

### Backwards compatibility

Fully backwards compatible. v0.2.0 consumers without the env vars get default behavior unchanged.

## v0.2.0 · 2026-04-22

Additions for Plan E (Meta-Admin panel + login/MFA UI).

### Added

- `useLogin` hook: email+password login with MFA detection. Reads user's TOTP factors after sign-in and signals `mfa-required` state if a verified factor exists.
- `useMfaEnroll` hook: one-shot TOTP enrollment. Returns `qrCodeSvg`, `secret`, `otpauthUri`. `submit(code)` runs challenge + verify.
- `useMfaChallenge` hook: post-login step-up authentication.
- `useImpersonationGate` hook: reads JWT claims, exposes `canImpersonate`, `needsMfaChallenge`, `isSuper`.
- `getSupabaseBrowserClient({cookieOptions: {domain, secure, sameSite}})`: enables cross-subdomain cookies.
- Admin wrappers in `@socios-ai/auth/admin`:
  - `startImpersonation`, `endImpersonation` (require `callerJwt` because the RPCs check `auth.uid()`)
  - `forceLogout` (requires `callerJwt`)
  - `grantMembership`, `revokeMembership` (require `callerJwt`)
  - `createUserWithMembership` (uses service role, includes invite link generation with email_exists fallback)
- New `MfaErrorCode` type. `AuthErrorCode` extended with `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `RATE_LIMITED`.

### Tests

- 35 new vitest cases (hooks via renderHook; admin wrappers via msw v2 fixtures matching real Supabase API shapes).
- Total package tests: 99.

### Backwards compatibility

Fully backwards compatible with v0.1.1. New parameters and exports only.

## v0.1.1 · 2026-04-22

### Bug fixes

- `admin/links`: `redirect_to` is now sent as a top-level field in the GoTrue `generate_link` request body. Previously it was nested under `options`, which GoTrue silently ignored, causing the action link to point to the project root instead of the intended path (e.g., `/set-password`).
- `admin/links`: `action_link` and `hashed_token` are now read from the top level of the GoTrue response. Previously the code read `res.properties.action_link` / `res.properties.hashed_token`, which matched a fictional response shape used in the msw test fixtures but not the real GoTrue API, causing a runtime crash in production.

## v0.1.0 · 2026-04-22

Initial release. Extracted from `socios-ai-identity-web` after Plan C work proved the patterns.

### Subpaths

- `@socios-ai/auth` (L1, framework-agnostic): `validateFromParam`, `deriveAppName`, `passwordSchema`, `resetFormSchema`, `getSupabaseBrowserClient`, `AuthErrorCode`.
- `@socios-ai/auth/react` (L2): `useTokenConsumption`, `useResetPassword`, `useSetPassword`, `useVerify`.
- `@socios-ai/auth/admin` (L1.5): `getSupabaseAdminClient`, `generateRecoveryLink`, `generateInviteLink`, `AuthAdminError`.

### Distribution

Via Git URL: `npm install github:Socios-AI/socios-ai-auth#v0.1.0`.
Consumer triggers `prepare` script (`tsup`) which builds `dist/` on install.
