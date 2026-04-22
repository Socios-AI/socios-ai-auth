import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { generateRecoveryLink, generateInviteLink, AuthAdminError } from "../../src/admin/links";

const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_KEY = "test-service-key";
const GENERATE_LINK_URL = `${SUPABASE_URL}/auth/v1/admin/generate_link`;

const server = setupServer();

beforeAll(() => {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  server.listen({ onUnhandledRequest: "error" });
});
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("generateRecoveryLink", () => {
  it("returns actionLink and hashedToken on success", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, async ({ request }) => {
        const body = await request.json() as { type: string; email: string; options?: { redirect_to?: string } };
        expect(body.type).toBe("recovery");
        expect(body.email).toBe("user@example.com");
        return HttpResponse.json({
          properties: {
            action_link: "https://test.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https://id.sociosai.com/set-password",
            hashed_token: "abc",
          },
        });
      }),
    );

    const result = await generateRecoveryLink({
      email: "user@example.com",
      redirectTo: "https://id.sociosai.com/set-password",
    });

    expect(result.actionLink).toContain("token=abc");
    expect(result.hashedToken).toBe("abc");
  });

  it("decodes \\u0026 in actionLink correctly (gotcha #2)", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, () => {
        return HttpResponse.json({
          properties: {
            action_link: "https://test.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https://id.sociosai.com/set-password",
            hashed_token: "abc",
          },
        });
      }),
    );

    const result = await generateRecoveryLink({ email: "u@x.com", redirectTo: "https://id.sociosai.com/set-password" });
    expect(result.actionLink).toContain("&type=recovery");
    expect(result.actionLink).not.toContain("\\u0026");
  });

  it("throws AuthAdminError on network failure", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, () => HttpResponse.error()),
    );

    await expect(generateRecoveryLink({ email: "u@x.com", redirectTo: "https://x" }))
      .rejects.toThrow(AuthAdminError);
  });
});

describe("generateInviteLink", () => {
  it("returns invite link on success (no fallback)", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, async ({ request }) => {
        const body = await request.json() as { type: string };
        expect(body.type).toBe("invite");
        return HttpResponse.json({
          properties: {
            action_link: "https://test.supabase.co/auth/v1/verify?token=invite&type=invite&redirect_to=https://id.sociosai.com/set-password",
            hashed_token: "invite",
          },
        });
      }),
    );

    const result = await generateInviteLink({
      email: "newuser@example.com",
      redirectTo: "https://id.sociosai.com/set-password",
    });

    expect(result.usedFallback).toBe(false);
    expect(result.actionLink).toContain("type=invite");
  });

  it("falls back to recovery on 422 email_exists (gotcha #3)", async () => {
    let callCount = 0;
    server.use(
      http.post(GENERATE_LINK_URL, async ({ request }) => {
        callCount++;
        const body = await request.json() as { type: string };
        if (callCount === 1) {
          expect(body.type).toBe("invite");
          return HttpResponse.json(
            { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" },
            { status: 422 },
          );
        }
        expect(body.type).toBe("recovery");
        return HttpResponse.json({
          properties: {
            action_link: "https://test.supabase.co/auth/v1/verify?token=rec&type=recovery&redirect_to=https://id.sociosai.com/set-password",
            hashed_token: "rec",
          },
        });
      }),
    );

    const result = await generateInviteLink({
      email: "existing@example.com",
      redirectTo: "https://id.sociosai.com/set-password",
    });

    expect(result.usedFallback).toBe(true);
    expect(result.actionLink).toContain("type=recovery");
    expect(callCount).toBe(2);
  });

  it("throws EMAIL_EXISTS when fallbackToRecovery is false and 422 returned", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, () =>
        HttpResponse.json(
          { code: 422, error_code: "email_exists", msg: "exists" },
          { status: 422 },
        ),
      ),
    );

    await expect(
      generateInviteLink({
        email: "x@x.com",
        redirectTo: "https://x",
        fallbackToRecovery: false,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_EXISTS" });
  });

  it("throws RATE_LIMITED on 429", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, () => HttpResponse.json({ msg: "rate limit" }, { status: 429 })),
    );

    await expect(generateRecoveryLink({ email: "x@x.com", redirectTo: "https://x" }))
      .rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("throws UNAUTHORIZED on 401", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, () => HttpResponse.json({ msg: "unauthorized" }, { status: 401 })),
    );

    await expect(generateRecoveryLink({ email: "x@x.com", redirectTo: "https://x" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("throws UNKNOWN on other 5xx", async () => {
    server.use(
      http.post(GENERATE_LINK_URL, () => HttpResponse.json({ msg: "server error" }, { status: 500 })),
    );

    await expect(generateRecoveryLink({ email: "x@x.com", redirectTo: "https://x" }))
      .rejects.toMatchObject({ code: "UNKNOWN", status: 500 });
  });
});
