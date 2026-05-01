# Changelog

## v0.2.7 · 2026-05-01

### Changed

- `useResetPassword.submit` no longer calls `supabase.auth.updateUser({ password })` directly. It now POSTs to a host-app endpoint (default `/api/auth/reset-password`) that performs the password rotation via the Supabase admin API. Endpoint is configurable via `useResetPassword({ resetEndpoint: "..." })`.

### Why

Plan G.6 turned on Supabase MFA enforcement, which makes `auth.updateUser({ password })` reject any session below AAL2 with `insufficient_aal` (`AAL2 session is required to update email or password when MFA is enabled.`). The recovery flow only mints AAL1 (the email link is the recovery factor; it does not satisfy MFA), so MFA-enrolled users hit a catch-22: they cannot reset their password because the second factor required to authorize the reset is itself the password they just lost (or its sibling TOTP, which they may also not have if they are recovering from a device loss).

Possession of the recovery email is independent evidence of identity sufficient to authorize a password rotation. The host app's endpoint reads the current cookie session (written by `useTokenConsumption.setSession`), uses it to identify the user, and rotates the password through the admin API which is not subject to AAL checks. This preserves MFA enforcement everywhere else and unblocks recovery for MFA users.

### Required host-app contract

The host app MUST expose a route at the configured endpoint (default `/api/auth/reset-password`) that:
- Accepts `POST { password: string }`.
- Verifies the requester via the cookie session.
- Rotates the password (e.g. `supabase.auth.admin.updateUserById(user.id, { password })`).
- Returns 2xx on success, non-2xx on failure.

Identity-web ships such a route as of this release. Other consumers of `useResetPassword` MUST add one before upgrading.

### Backwards compatibility

Breaking for consumers that do not provide the endpoint. The hook still calls `supabase.auth.signOut()` after a successful rotation, so observable session-cleanup behavior is unchanged.

## v0.2.6 · 2026-04-30

### Added

- `getSupabaseImplicitClient(opts?)` exported from the package entrypoint. Returns a one-shot Supabase client built directly from `@supabase/supabase-js` (bypassing `@supabase/ssr`) with `flowType: "implicit"` and session persistence disabled. Use it for `resetPasswordForEmail` and similar email-link issuers where PKCE's same-browser-context binding breaks the cross-device flow (request reset on desktop, click email on phone).

### Why

`getSupabaseBrowserClient` has set `flowType: "implicit"` since v0.2.4, but `@supabase/ssr` v0.5+ silently overrides it to `"pkce"` (acknowledged in v0.2.5 notes). Recovery emails consequently produced PKCE links that fail with HTTP 400 from `/auth/v1/token?grant_type=pkce` whenever the email is opened in a different browser context than the one that originated the request. There is no way to fix this from `getSupabaseBrowserClient` while remaining on `@supabase/ssr` v0.5+, so this release adds a separate, narrowly-scoped client just for the request side. The consumer side (`useTokenConsumption`) already supports the resulting `#access_token=&refresh_token=` redirect via `setSession`.

### Backwards compatibility

Pure addition. `getSupabaseBrowserClient` is unchanged. Consumers must explicitly opt into the new helper for the recovery-request call site; existing code paths still go through `@supabase/ssr`.

## v0.2.5 · 2026-04-30

### Fixed

- `useTokenConsumption` now handles the PKCE redirect shape (`?code=<auth_code>`) by calling `supabase.auth.exchangeCodeForSession`. v0.2.4 set `flowType: "implicit"` on the browser client, but `@supabase/ssr` v0.5+ hard-overrides this to `"pkce"` after the user's options spread, so recovery email links were unconsumed and the `/reset` page silently fell back to the request-email form (`MISSING_TOKEN`).
- The hook also now classifies the PKCE error redirect (`?error=access_denied&error_code=otp_expired&...`) into `EXPIRED` / `INVALID` instead of leaving the user at `MISSING_TOKEN` after they click an expired link.

### Backwards compatibility

Pure addition. Existing hash-token (implicit) and `?token_hash=` (OTP) paths are untouched and still take precedence in `source: "auto"` mode.

### Notes

The `flowType: "implicit"` config introduced in v0.2.4 is now effectively a no-op (overridden by `@supabase/ssr`), but kept in place defensively in case a future `@supabase/ssr` release respects user-supplied options. The cross-browser claim from v0.2.4's notes only held under the assumption that override; in practice PKCE binds the code verifier to the originating browser. PKCE remains the deployed flow for now (more secure under the same-browser assumption); a future change could migrate to magic-link OTP if cross-browser becomes a hard requirement.

## v0.2.4 · 2026-04-25

### Changed

- `getSupabaseBrowserClient` now configures the underlying Supabase client with `auth.flowType: "implicit"`. This makes email-based recovery, invite, and confirmation links work cross-browser: the user can request a reset on one device and click the email on another. The PKCE flow (the previous default in `@supabase/ssr`) binds a code verifier to the originating browser's localStorage, which silently breaks recovery whenever the user opens the email anywhere else.
- The trade-off is a marginal reduction in OAuth security, which we don't use (OAuth was revoked in Plan C). Recovery / invite / signup tokens remain single-use and short-TTL on the server.

### Backwards compatibility

Public API surface unchanged. Behavior change is in the underlying Supabase client config — consumers will see recovery email links resolve correctly even when opened in a different browser.

## v0.2.3 · 2026-04-22

### Added

- `promoteToSuperAdmin` and `demoteFromSuperAdmin` admin helpers.

## v0.2.2 · 2026-04-22

### Added

- Re-export `MfaErrorCode` from the main entry. The type was added in v0.2.0 but only available via internal path. Consumers can now `import type { MfaErrorCode } from "@socios-ai/auth"`.

### Backwards compatibility

Fully backwards compatible. Pure addition.

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
