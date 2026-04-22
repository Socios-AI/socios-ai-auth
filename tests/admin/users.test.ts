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
  it("calls rpc/create_user_with_membership then generates invite link", async () => {
    let rpcBody: unknown = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/create_user_with_membership", async ({ request }) => {
        rpcBody = await request.json();
        return HttpResponse.json({ user_id: "u-1", membership_id: "mb-1" });
      }),
      http.post("https://test.supabase.co/auth/v1/admin/generate_link", async () =>
        HttpResponse.json({
          id: "u-1",
          email: "new@user.com",
          action_link: "https://test.supabase.co/auth/v1/verify?token=tk&type=invite&redirect_to=https://id.sociosai.com/set-password",
          hashed_token: "tk",
        }),
      ),
    );
    const { createUserWithMembership } = await import("../../src/admin/users");
    const result = await createUserWithMembership({
      email: "new@user.com",
      appSlug: "case-predictor",
      roleSlug: "partner-admin",
      orgId: "org-1",
      redirectTo: "https://id.sociosai.com/set-password",
    });
    expect(rpcBody).toEqual({
      p_email: "new@user.com",
      p_app_slug: "case-predictor",
      p_role_slug: "partner-admin",
      p_org_id: "org-1",
    });
    expect(result.userId).toBe("u-1");
    expect(result.membershipId).toBe("mb-1");
    expect(result.actionLink).toContain("/auth/v1/verify?token=tk");
  });

  it("falls back to generateInviteLink fallback (recovery) when generate_link returns email_exists", async () => {
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/create_user_with_membership", () =>
        HttpResponse.json({ user_id: "u-2", membership_id: "mb-2" }),
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
      appSlug: "case-predictor",
      roleSlug: "end-user",
      redirectTo: "https://id.sociosai.com/set-password",
    });
    expect(result.userId).toBe("u-2");
    expect(result.actionLink).toContain("token=rec&type=recovery");
  });

  it("throws on missing required args", async () => {
    const { createUserWithMembership } = await import("../../src/admin/users");
    await expect(
      createUserWithMembership({ email: "", appSlug: "a", roleSlug: "r", redirectTo: "https://x.com" }),
    ).rejects.toThrow(/email/);
  });
});
