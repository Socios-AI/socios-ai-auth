# Changelog

## v0.1.0 · 2026-04-22

Initial release. Extracted from `socios-ai-identity-web` after Plan C work proved the patterns.

### Subpaths

- `@socios-ai/auth` (L1, framework-agnostic): `validateFromParam`, `deriveAppName`, `passwordSchema`, `resetFormSchema`, `getSupabaseBrowserClient`, `AuthErrorCode`.
- `@socios-ai/auth/react` (L2): `useTokenConsumption`, `useResetPassword`, `useSetPassword`, `useVerify`.
- `@socios-ai/auth/admin` (L1.5): `getSupabaseAdminClient`, `generateRecoveryLink`, `generateInviteLink`, `AuthAdminError`.

### Distribution

Via Git URL: `npm install github:Socios-AI/socios-ai-auth#v0.1.0`.
Consumer triggers `prepare` script (`tsup`) which builds `dist/` on install.
