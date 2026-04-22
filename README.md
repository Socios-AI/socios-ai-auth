# @socios-ai/auth

Auth helpers and React hooks for Sócios AI Identity. Built on top of `@supabase/supabase-js` and `@supabase/ssr`.

Distributed via Git URL deps (no npm registry). Consumers install by pinning a tag.

The package has three subpaths:

| Subpath | What it gives you |
|---|---|
| `@socios-ai/auth` | Framework-agnostic helpers: URL validation, password schemas, browser client factory |
| `@socios-ai/auth/react` | Headless React hooks for the reset-password, set-password, and verify-email flows |
| `@socios-ai/auth/admin` | Node-only admin helpers for generating invite and recovery links |

## Install

```bash
npm install github:Socios-AI/socios-ai-auth#v0.1.0
```

The `prepare` script in this package runs `tsup` automatically on install,
producing the `dist/` directory consumers actually use.

You also need the Supabase clients as peer deps:

```bash
npm install @supabase/supabase-js @supabase/ssr zod
# add react if you use the /react subpath
npm install react
```

## Quickstart, `@socios-ai/auth`

```ts
import { validateFromParam, deriveAppName, getSupabaseBrowserClient, passwordSchema } from "@socios-ai/auth";

const supabase = getSupabaseBrowserClient();
const result = validateFromParam("https://case-predictor.sociosai.com");
if (result.valid) {
  console.log(deriveAppName("https://case-predictor.sociosai.com")); // "CASE-PREDICTOR"
}
```

## Quickstart, `@socios-ai/auth/react`

```tsx
import { useResetPassword } from "@socios-ai/auth/react";

function ResetForm() {
  const { state, errorCode, submit } = useResetPassword();

  if (state === "initial") return <Spinner />;
  if (state === "error") return <p>Erro: {errorCode}</p>;
  if (state === "success") return <p>Senha redefinida.</p>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit("NewPass1!"); }}>
      <button disabled={state === "submitting"}>Salvar</button>
    </form>
  );
}
```

The hook returns error codes (`EXPIRED`, `INVALID`, `MISSING_TOKEN`, `API_ERROR`), not strings. Map codes to copy in your app to keep i18n at the consumer layer.

## Quickstart, `@socios-ai/auth/admin`

```ts
import { generateRecoveryLink } from "@socios-ai/auth/admin";

const { actionLink } = await generateRecoveryLink({
  email: "user@example.com",
  redirectTo: "https://id.sociosai.com/set-password",
});
console.log(actionLink);
```

Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `process.env` by default.

## Login + MFA hooks (v0.2.0)

### `useLogin`

```ts
import { useLogin } from "@socios-ai/auth/react";

function LoginForm() {
  const { state, errorCode, mfaRequired, submit } = useLogin();
  // state: "idle" | "submitting" | "success" | "mfa-required" | "error"
  // mfaRequired: true if user has verified TOTP factor and JWT lacks amr=totp
}
```

### `useMfaEnroll`

```ts
import { useMfaEnroll } from "@socios-ai/auth/react";

function EnrollForm() {
  const { state, qrCodeSvg, secret, otpauthUri, submit, errorCode } = useMfaEnroll();
  // state: "loading" | "ready" | "submitting" | "success" | "error"
  // submit(code) calls challenge + verify
}
```

### `useMfaChallenge`

```ts
import { useMfaChallenge } from "@socios-ai/auth/react";

function ChallengeForm() {
  const { state, errorCode, submit } = useMfaChallenge();
}
```

### `useImpersonationGate`

```ts
import { useImpersonationGate } from "@socios-ai/auth/react";

function ImpersonateButton() {
  const { isSuper, canImpersonate, needsMfaChallenge, refresh } = useImpersonationGate();
  if (!isSuper) return null;
  if (needsMfaChallenge) return <MfaChallengeForm onSuccess={refresh} />;
  return <button disabled={!canImpersonate}>Impersonate</button>;
}
```

## Admin RPC wrappers (v0.2.0)

All call Plan A backend RPCs. RPCs that check `auth.uid()` require `callerJwt`.

```ts
import {
  startImpersonation,
  endImpersonation,
  forceLogout,
  grantMembership,
  revokeMembership,
  createUserWithMembership,
} from "@socios-ai/auth/admin";

const { sessionId, expiresAt } = await startImpersonation({
  targetUserId: "uuid",
  reason: "Investigating ticket #123",
  callerJwt: req.headers.authorization?.replace(/^Bearer /, "") ?? "",
});

const { membershipId } = await grantMembership({
  userId: "uuid",
  appSlug: "case-predictor",
  roleSlug: "partner-admin",
  orgId: "uuid",
  callerJwt: "...",
});

const { userId, actionLink } = await createUserWithMembership({
  email: "new@user.com",
  appSlug: "case-predictor",
  roleSlug: "partner-admin",
  orgId: "uuid",
  redirectTo: "https://id.sociosai.com/set-password",
});
```

`createUserWithMembership` uses service role internally (no `callerJwt` needed). All other admin wrappers require `callerJwt` because the underlying RPCs check `auth.uid()`.

## Cross-subdomain cookies (v0.2.0)

```ts
import { getSupabaseBrowserClient } from "@socios-ai/auth";

const supabase = getSupabaseBrowserClient({
  cookieOptions: {
    domain: ".sociosai.com",
    secure: true,
    sameSite: "lax",
  },
});
```

When `cookieOptions.domain` is set, sessions are visible across all subdomains of the configured domain. Useful when ID and admin apps share the same Supabase project.

## Versioning

Pre-1.0. Minor bumps may include breaking changes. Always pin to a specific tag in
consumer `package.json`. See `RELEASING.md` for how new versions are cut.

## License

MIT
