# Changelog

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
