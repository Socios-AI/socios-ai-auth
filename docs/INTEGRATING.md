# Integrating `@socios-ai/auth` in a new product app

This guide walks a new consumer app through plugging into the Sócios AI identity foundation. Target: a Next.js 15 App Router project (CASE-PREDICTOR is the reference). Other React frameworks work the same way for the hooks; the SSR/middleware bits assume Next.js.

## Pre-requisites

You need from the platform team:
- Supabase project URL · `NEXT_PUBLIC_SUPABASE_URL=https://axyssxqttfnbtawanasf.supabase.co`
- Supabase anon key · `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
- The cookie domain to share sessions across subdomains · `NEXT_PUBLIC_COOKIE_DOMAIN=.sociosai.com`
- Your subdomain added to the platform allow-list · `case-predictor.sociosai.com` (or whatever yours is)

## Step 1 · Install

The package is distributed via Git URL. Pin a tag — never `main`.

```bash
npm install github:Socios-AI/socios-ai-auth#v0.2.8
```

Install the peer deps:

```bash
npm install @supabase/supabase-js @supabase/ssr zod react
```

**Critical**: ship `scripts/verify-auth-pin.sh` in your repo and wire it into CI. The npm git-deps lockfile resolution has a known pitfall where bumping the tag in `package.json` does NOT update the resolved SHA in `package-lock.json`, so `npm ci` (Docker) silently keeps the old version. Identity-web and admin-web both ship this script — copy it. See `feedback_npm_git_dep_lockfile_gotcha.md` in the platform memory.

## Step 2 · Cookie + browser client setup

Configure the browser client at app start. The package's `getSupabaseBrowserClient` reads `NEXT_PUBLIC_*` env vars and returns a singleton.

```ts
// lib/supabase.ts
import { getSupabaseBrowserClient } from "@socios-ai/auth";

export const sb = getSupabaseBrowserClient({
  cookieOptions: {
    domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    sameSite: "lax",
    secure: process.env.NEXT_PUBLIC_COOKIE_SECURE === "true",
  },
});
```

Set `NEXT_PUBLIC_COOKIE_DOMAIN=.sociosai.com` (with the leading dot) so the same auth cookie is visible to `id.sociosai.com`, `admin.sociosai.com`, and your app.

## Step 3 · Wire the auth flows

The platform owns the login/recovery/MFA UI on `id.sociosai.com`. Your consumer app does NOT host those pages — instead, you redirect users out to `id.sociosai.com` when they need to log in, and they come back with a session cookie that your app can read.

### Sending a user to login

```ts
const myUrl = encodeURIComponent("https://case-predictor.sociosai.com/dashboard");
window.location.href = `https://id.sociosai.com/login?from=${myUrl}`;
```

After successful login (with MFA challenge if applicable), id.sociosai.com redirects back to the URL in `?from=`. The session cookie is set on `.sociosai.com` so your app reads it without further round-trips.

### Reading the session in a server component

```tsx
// app/dashboard/page.tsx
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return <p>Not logged in</p>;
  return <p>Hello, {user.email}</p>;
}
```

### Middleware: gating routes

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = new Set(["/", "/login-redirect"]);

export function middleware(req: NextRequest) {
  if (PUBLIC.has(req.nextUrl.pathname)) return NextResponse.next();

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/^https?:\/\//, "").split(".")[0];
  const baseName = `sb-${projectRef}-auth-token`;

  // The cookie is chunked by @supabase/ssr v0.5+ when large.
  const hasSession = req.cookies.has(baseName)
    || req.cookies.getAll().some((c) => c.name.startsWith(`${baseName}.`));

  if (!hasSession) {
    const myUrl = encodeURIComponent(req.nextUrl.toString());
    return NextResponse.redirect(`https://id.sociosai.com/login?from=${myUrl}`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## Step 4 · Optional · MFA enrollment in your app

If your app needs to enroll MFA factors directly (rather than delegating to id.sociosai.com), use `useMfaEnroll` with a per-app friendlyName so the authenticator app shows your app's name:

```tsx
import { useMfaEnroll } from "@socios-ai/auth/react";

function EnrollPage() {
  const { state, qrCodeSvg, secret, submit } = useMfaEnroll({
    friendlyName: "CASE-PREDICTOR",
  });
  // ...render QR code and TOTP code form
}
```

Without `friendlyName`, Supabase falls back to the project ref (`axyssxqttfnbtawanasf`) and users see gibberish in iOS Passwords / 1Password / etc.

## Step 5 · Consume role/membership claims

Decode the JWT to read role-style claims injected by the platform's `custom_access_token_hook`:

```ts
type SuperAdminClaims = {
  sub: string;
  email?: string;
  super_admin?: boolean;
  mfa_enrolled?: boolean;
  memberships?: Array<{ app_slug: string; org_id: string | null; role_slug: string }>;
  subscriptions?: Array<{ plan_id: string; status: string }>;
};
```

Use the `decodeJwtPayload` helper from your own `lib/jwt.ts` (identity-web ships a reference impl). Don't trust unverified JWTs for security decisions — for sensitive checks call back to Supabase via `auth.getUser()`.

## Common pitfalls

- **Cookie domain mismatch**: forgetting the leading dot in `NEXT_PUBLIC_COOKIE_DOMAIN` breaks SSO. It MUST be `.sociosai.com`.
- **Lockfile drift on bump**: see Step 1. Always run `verify-auth-pin.sh` in CI.
- **AAL2 enforcement on `auth.updateUser`**: the platform has MFA enforcement on. `supabase.auth.updateUser({ password })` returns `401 insufficient_aal` for any AAL1 session. If you need to rotate passwords from your consumer, use the platform's `/api/auth/reset-password` endpoint pattern (see `useResetPassword` source).
- **`auth.getUser()` on AAL1 recovery sessions**: the same enforcement makes `getUser` 401 on certain reads. Decode JWT locally for non-sensitive claims like email.
- **Trailing slash on `/auth/v1`**: Supabase's GoTrue base URL already includes `/auth/v1`. Don't append it again when building auth URLs manually (PR #13 incident in identity-web).
- **PKCE same-browser-context binding**: the recovery flow you build using `resetPasswordForEmail` will fail cross-browser unless you use `getSupabaseImplicitClient` (v0.2.6+). See `useTokenConsumption` source.

## Where to look when something breaks

- **Identity-web reference**: `~/projects/socios-ai/socios-ai-identity-web/` is the canonical Next.js consumer; copy patterns from `app/login`, `app/reset`, `middleware.ts`, `app/api/auth/`.
- **Auth package source**: `~/projects/socios-ai/socios-ai-auth/src/` — read the hook source when behavior is surprising.
- **CHANGELOG.md**: every breaking change is documented with the why. Read before bumping across major segments.
- **Memory artifacts**: platform team's `~/.claude/projects/-home-antonio-projects-socios-ai/memory/` has reference docs for every gotcha we have hit.

## Versioning

Pre-1.0. Pin to exact tags, NOT a moving ref. Every minor version may carry breaking changes documented in CHANGELOG.md. Check the changelog before bumping past:

- `v0.2.4 → v0.2.5` (PKCE token consumption shape)
- `v0.2.6 → v0.2.7` (useResetPassword endpoint indirection — host app MUST provide `/api/auth/reset-password`)

When v1.0 lands the contract becomes stable and we follow strict semver.
