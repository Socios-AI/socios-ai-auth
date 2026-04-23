import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer();

beforeAll(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createUserWithMembership", () => {
  it("calls create_user_with_membership with full_name and returns userId + actionLink", async () => {
    let rpcBody: unknown = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/create_user_with_membership", async ({ request }) => {
        rpcBody = await request.json();
        return HttpResponse.json("user-uuid-123");
      }),
      http.post("https://test.supabase.co/auth/v1/admin/generate_link", async () =>
        HttpResponse.json({
          id: "user-uuid-123",
          email: "new@example.com",
          action_link: "https://id.sociosai.com/set-password?token=abc",
          hashed_token: "abc",
        }),
      ),
    );
    const { createUserWithMembership } = await import("../../src/admin/users");
    const result = await createUserWithMembership({
      email: "new@example.com",
      fullName: "New User",
      appSlug: "case-predictor",
      roleSlug: "end-user",
      redirectTo: "https://id.sociosai.com/set-password",
    });
    expect(rpcBody).toEqual({
      p_email: "new@example.com",
      p_full_name: "New User",
      p_app_slug: "case-predictor",
      p_role_slug: "end-user",
    });
    expect(result.userId).toBe("user-uuid-123");
    expect(result.actionLink).toBe("https://id.sociosai.com/set-password?token=abc");
  });

  it("includes p_org_id when orgId is provided", async () => {
    let rpcBody: unknown = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/create_user_with_membership", async ({ request }) => {
        rpcBody = await request.json();
        return HttpResponse.json("org-user-uuid-456");
      }),
      http.post("https://test.supabase.co/auth/v1/admin/generate_link", async () =>
        HttpResponse.json({
          id: "org-user-uuid-456",
          email: "orguser@example.com",
          action_link: "https://id.sociosai.com/set-password?token=def",
          hashed_token: "def",
        }),
      ),
    );
    const { createUserWithMembership } = await import("../../src/admin/users");
    const result = await createUserWithMembership({
      email: "orguser@example.com",
      fullName: "Org User",
      appSlug: "case-predictor",
      roleSlug: "partner-admin",
      orgId: "org-uuid",
      redirectTo: "https://id.sociosai.com/set-password",
    });
    expect(rpcBody).toEqual({
      p_email: "orguser@example.com",
      p_full_name: "Org User",
      p_app_slug: "case-predictor",
      p_role_slug: "partner-admin",
      p_org_id: "org-uuid",
    });
    expect(result.userId).toBe("org-user-uuid-456");
  });

  it("falls back to generateInviteLink fallback (recovery) when generate_link returns email_exists", async () => {
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/create_user_with_membership", () =>
        HttpResponse.json("u-2"),
      ),
      http.post("https://test.supabase.co/auth/v1/admin/generate_link", async ({ request }) => {
        const body = await request.json() as { type?: string };
        if (body.type === "invite") {
          return HttpResponse.json({ error_code: "email_exists", msg: "Email already exists" }, { status: 422 });
        }
        return HttpResponse.json({
          id: "u-2",
          email: "exists@u.com",
          action_link: "https://test.supabase.co/auth/v1/verify?token=rec&type=recovery&redirect_to=https://id.sociosai.com/set-password",
          hashed_token: "rec",
        });
      }),
    );
    const { createUserWithMembership } = await import("../../src/admin/users");
    const result = await createUserWithMembership({
      email: "exists@u.com",
      fullName: "Exists User",
      appSlug: "case-predictor",
      roleSlug: "end-user",
      redirectTo: "https://id.sociosai.com/set-password",
    });
    expect(result.userId).toBe("u-2");
    expect(result.actionLink).toContain("token=rec&type=recovery");
  });

  it("throws when fullName is missing", async () => {
    const { createUserWithMembership } = await import("../../src/admin/users");
    await expect(
      createUserWithMembership({
        email: "x@y.com",
        // @ts-expect-error - intentionally omitting fullName for the test
        fullName: undefined,
        appSlug: "case-predictor",
        roleSlug: "end-user",
        redirectTo: "https://id.sociosai.com/set-password",
      } as never),
    ).rejects.toThrow("fullName is required");
  });

  it("throws on missing required args", async () => {
    const { createUserWithMembership } = await import("../../src/admin/users");
    await expect(
      // @ts-expect-error - intentionally omitting fullName for the test
      createUserWithMembership({ email: "", fullName: "X", appSlug: "a", roleSlug: "r", redirectTo: "https://x.com" }),
    ).rejects.toThrow(/email/);
  });
});
