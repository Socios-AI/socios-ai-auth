import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
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

describe("startImpersonation", () => {
  it("calls rpc/start_impersonation with caller JWT and maps response", async () => {
    let receivedAuth: string | null = null;
    let receivedBody: any = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/start_impersonation", async ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        receivedBody = await request.json();
        return HttpResponse.json({
          session_id: "sess-1",
          actor_user_id: "actor-1",
          target_user_id: "target-1",
          expires_at: "2026-04-22T16:00:00Z",
        });
      }),
    );
    const { startImpersonation } = await import("../../src/admin/impersonation");
    const result = await startImpersonation({
      targetUserId: "target-1",
      reason: "Investigating ticket #123",
      callerJwt: "caller-jwt-here",
    });
    expect(result).toEqual({
      sessionId: "sess-1",
      actorUserId: "actor-1",
      targetUserId: "target-1",
      expiresAt: "2026-04-22T16:00:00Z",
    });
    expect(receivedAuth).toBe("Bearer caller-jwt-here");
    expect(receivedBody).toEqual({
      p_target_user_id: "target-1",
      p_reason: "Investigating ticket #123",
    });
  });

  it("throws AuthAdminError UNAUTHORIZED when RPC raises 'only super_admin can impersonate'", async () => {
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/start_impersonation", () =>
        HttpResponse.json(
          { code: "P0001", message: "only super_admin can impersonate" },
          { status: 400 },
        ),
      ),
    );
    const { startImpersonation } = await import("../../src/admin/impersonation");
    const { AuthAdminError } = await import("../../src/admin/links");
    await expect(
      startImpersonation({ targetUserId: "t", reason: "test reason here", callerJwt: "j" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws on missing callerJwt", async () => {
    const { startImpersonation } = await import("../../src/admin/impersonation");
    await expect(
      startImpersonation({ targetUserId: "t", reason: "test reason here", callerJwt: "" }),
    ).rejects.toThrow(/callerJwt/);
  });
});

describe("endImpersonation", () => {
  it("calls rpc/end_impersonation with caller JWT and session id", async () => {
    let receivedBody: any = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/end_impersonation", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(null);
      }),
    );
    const { endImpersonation } = await import("../../src/admin/impersonation");
    const result = await endImpersonation({ sessionId: "sess-1", callerJwt: "j" });
    expect(receivedBody).toEqual({ p_session_id: "sess-1" });
    expect(result.endedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
