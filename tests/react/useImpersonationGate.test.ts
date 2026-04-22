import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const getSessionMock = vi.fn();

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getSession: getSessionMock },
  }),
}));

// Helper: make a JWT with the given payload claims (signature is irrelevant for our reads)
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

beforeEach(() => {
  getSessionMock.mockReset();
});

describe("useImpersonationGate", () => {
  it("returns canImpersonate=true when super-admin and amr has totp", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: makeJwt({
            is_super_admin: true,
            amr: [{ method: "password" }, { method: "totp", timestamp: 1234567890 }],
          }),
        },
      },
      error: null,
    });
    const { useImpersonationGate } = await import("../../src/react/useImpersonationGate");
    const { result } = renderHook(() => useImpersonationGate());
    await waitFor(() => expect(result.current.isSuper).toBe(true));
    expect(result.current.canImpersonate).toBe(true);
    expect(result.current.needsMfaChallenge).toBe(false);
  });

  it("returns needsMfaChallenge=true when super-admin but amr lacks totp", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: makeJwt({ is_super_admin: true, amr: [{ method: "password" }] }),
        },
      },
      error: null,
    });
    const { useImpersonationGate } = await import("../../src/react/useImpersonationGate");
    const { result } = renderHook(() => useImpersonationGate());
    await waitFor(() => expect(result.current.isSuper).toBe(true));
    expect(result.current.canImpersonate).toBe(false);
    expect(result.current.needsMfaChallenge).toBe(true);
  });

  it("returns isSuper=false for normal user", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: { access_token: makeJwt({ is_super_admin: false, amr: [{ method: "password" }] }) },
      },
      error: null,
    });
    const { useImpersonationGate } = await import("../../src/react/useImpersonationGate");
    const { result } = renderHook(() => useImpersonationGate());
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled());
    expect(result.current.isSuper).toBe(false);
    expect(result.current.canImpersonate).toBe(false);
    expect(result.current.needsMfaChallenge).toBe(false);
  });

  it("returns all false when no session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    const { useImpersonationGate } = await import("../../src/react/useImpersonationGate");
    const { result } = renderHook(() => useImpersonationGate());
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled());
    expect(result.current.isSuper).toBe(false);
    expect(result.current.canImpersonate).toBe(false);
  });

  it("refresh() re-reads the session and updates state", async () => {
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: { access_token: makeJwt({ is_super_admin: true, amr: [{ method: "password" }] }) } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: makeJwt({ is_super_admin: true, amr: [{ method: "password" }, { method: "totp" }] }) } },
        error: null,
      });

    const { useImpersonationGate } = await import("../../src/react/useImpersonationGate");
    const { result } = renderHook(() => useImpersonationGate());
    await waitFor(() => expect(result.current.needsMfaChallenge).toBe(true));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.canImpersonate).toBe(true);
  });
});
