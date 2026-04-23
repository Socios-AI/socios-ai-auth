import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
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

describe("promoteToSuperAdmin", () => {
  it("calls promote_to_super_admin RPC with caller JWT", async () => {
    let body: unknown = null;
    let receivedAuth: string | null = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/promote_to_super_admin", async ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        body = await request.json();
        return HttpResponse.json(null);
      }),
    );
    const { promoteToSuperAdmin } = await import("../../src/admin/super-admin");
    await promoteToSuperAdmin({
      userId: "u-1",
      reason: "promoted to super admin for ops handover",
      callerJwt: "jwt-1",
    });
    expect(receivedAuth).toBe("Bearer jwt-1");
    expect(body).toEqual({
      p_user_id: "u-1",
      p_reason: "promoted to super admin for ops handover",
    });
  });

  it("throws on missing callerJwt", async () => {
    const { promoteToSuperAdmin } = await import("../../src/admin/super-admin");
    await expect(
      promoteToSuperAdmin({ userId: "u-1", reason: "valid reason here", callerJwt: "" }),
    ).rejects.toThrow("callerJwt is required");
  });

  it("throws on missing userId", async () => {
    const { promoteToSuperAdmin } = await import("../../src/admin/super-admin");
    await expect(
      promoteToSuperAdmin({ userId: "", reason: "valid reason here", callerJwt: "jwt-1" }),
    ).rejects.toThrow("userId is required");
  });

  it("throws on short reason", async () => {
    const { promoteToSuperAdmin } = await import("../../src/admin/super-admin");
    await expect(
      promoteToSuperAdmin({ userId: "u-1", reason: "no", callerJwt: "jwt-1" }),
    ).rejects.toThrow("reason must be at least 5 chars");
  });

  it("throws AuthAdminError on RPC failure", async () => {
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/promote_to_super_admin", () =>
        HttpResponse.json({ message: "permission denied" }, { status: 400 }),
      ),
    );
    const { promoteToSuperAdmin } = await import("../../src/admin/super-admin");
    await expect(
      promoteToSuperAdmin({ userId: "u-1", reason: "valid reason here", callerJwt: "jwt-1" }),
    ).rejects.toThrow("permission denied");
  });
});

describe("demoteFromSuperAdmin", () => {
  it("calls demote_from_super_admin RPC with caller JWT", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/demote_from_super_admin", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(null);
      }),
    );
    const { demoteFromSuperAdmin } = await import("../../src/admin/super-admin");
    await demoteFromSuperAdmin({
      userId: "u-2",
      reason: "left the operations team",
      callerJwt: "jwt-1",
    });
    expect(body).toEqual({
      p_user_id: "u-2",
      p_reason: "left the operations team",
    });
  });

  it("throws on missing callerJwt", async () => {
    const { demoteFromSuperAdmin } = await import("../../src/admin/super-admin");
    await expect(
      demoteFromSuperAdmin({ userId: "u-2", reason: "valid reason here", callerJwt: "" }),
    ).rejects.toThrow("callerJwt is required");
  });

  it("throws on short reason", async () => {
    const { demoteFromSuperAdmin } = await import("../../src/admin/super-admin");
    await expect(
      demoteFromSuperAdmin({ userId: "u-2", reason: "x", callerJwt: "jwt-1" }),
    ).rejects.toThrow("reason must be at least 5 chars");
  });
});
