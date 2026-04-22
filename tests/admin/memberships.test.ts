import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer();

beforeAll(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("grantMembership", () => {
  it("calls rpc/grant_membership and returns membership id", async () => {
    let body: any = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/grant_membership", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json("mb-1");
      }),
    );
    const { grantMembership } = await import("../../src/admin/memberships");
    const result = await grantMembership({
      userId: "u1",
      appSlug: "case-predictor",
      roleSlug: "partner-admin",
      orgId: "org-1",
      callerJwt: "j",
    });
    expect(body).toEqual({
      p_user_id: "u1",
      p_app_slug: "case-predictor",
      p_role_slug: "partner-admin",
      p_org_id: "org-1",
    });
    expect(result).toEqual({ membershipId: "mb-1" });
  });

  it("omits p_org_id from request body when orgId is undefined", async () => {
    let body: any = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/grant_membership", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json("mb-2");
      }),
    );
    const { grantMembership } = await import("../../src/admin/memberships");
    await grantMembership({
      userId: "u1",
      appSlug: "case-predictor",
      roleSlug: "end-user",
      callerJwt: "j",
    });
    expect(body).toEqual({
      p_user_id: "u1",
      p_app_slug: "case-predictor",
      p_role_slug: "end-user",
    });
    expect(body).not.toHaveProperty("p_org_id");
  });
});

describe("revokeMembership", () => {
  it("calls rpc/revoke_membership and returns revokedAt", async () => {
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/revoke_membership", () =>
        HttpResponse.json("2026-04-22T16:00:00Z"),
      ),
    );
    const { revokeMembership } = await import("../../src/admin/memberships");
    const result = await revokeMembership({
      membershipId: "mb-1",
      reason: "User left firm",
      callerJwt: "j",
    });
    expect(result).toEqual({ revokedAt: "2026-04-22T16:00:00Z" });
  });
});
