import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName } from "../edge/index";

const ID_LOGIN = "https://id.sociosai.com/login";
const COOKIE_DOMAIN = ".sociosai.com";

/**
 * Build the logout response for a Sócios AI consumer app (admin, partners, ...).
 *
 * Clears the cross-subdomain Supabase session cookie (base + every chunk) ON THE
 * RETURNED response and redirects to the Identity login at id.sociosai.com.
 *
 * Why the deletions are set on `res.cookies` (not via cookies().set): in the Next
 * App Router, mutating the cookies() store and then returning your OWN
 * NextResponse drops the Set-Cookie headers, so the cookie is never cleared.
 * Attaching the deletions to the returned response is what actually logs the user
 * out across subdomains.
 *
 * @param from absolute URL of the app the user is logging out from (used as the
 *   `from` param so Identity can route back after re-login).
 */
export async function signOutResponse(opts: { from: string }): Promise<NextResponse> {
  const cookieStore = await cookies();
  const baseName = sessionCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const target = new URL(ID_LOGIN);
  target.searchParams.set("msg", "logged_out");
  target.searchParams.set("from", opts.from);
  const res = NextResponse.redirect(target, { status: 303 });

  if (baseName) {
    // Clear the base cookie + ANY number of chunks: the reader is unbounded, so a
    // fixed cap would leave orphan chunks. Combine what the browser sent with a
    // defensive fixed range. Domain .sociosai.com matches how login set it.
    const present = cookieStore
      .getAll()
      .map((c) => c.name)
      .filter((n) => n === baseName || n.startsWith(`${baseName}.`));
    const fallback = [baseName, ...Array.from({ length: 12 }, (_, i) => `${baseName}.${i}`)];
    for (const name of Array.from(new Set([...present, ...fallback]))) {
      res.cookies.set({
        name,
        value: "",
        domain: COOKIE_DOMAIN,
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: true,
      });
    }
  }

  return res;
}
