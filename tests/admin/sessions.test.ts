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

describe("forceLogout", () => {
  it("calls rpc/force_logout and returns revokedSessions count", async () => {
    let body: any = null;
    server.use(
      http.post("https://test.supabase.co/rest/v1/rpc/force_logout", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(3);
      }),
    );
    const { forceLogout } = await import("../../src/admin/sessions");
    const result = await forceLogout({
      targetUserId: "u1",
      reason: "Compromised account",
      callerJwt: "j",
    });
    expect(body).toEqual({ p_target_user_id: "u1", p_reason: "Compromised account" });
    expect(result).toEqual({ revokedSessions: 3 });
  });

  it("throws on missing required args", async () => {
    const { forceLogout } = await import("../../src/admin/sessions");
    await expect(forceLogout({ targetUserId: "", reason: "ok", callerJwt: "j" })).rejects.toThrow(/targetUserId/);
    await expect(forceLogout({ targetUserId: "u", reason: "no", callerJwt: "j" })).rejects.toThrow(/reason/);
  });
});
