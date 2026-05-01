import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useResetPassword } from "../../src/react/useResetPassword";

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "../../src/browser/client";

const mockSetSession = vi.fn();
const mockSignOut = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: {
      setSession: mockSetSession,
      signOut: mockSignOut,
    },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  mockSetSession.mockReset();
  mockSignOut.mockReset();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  Object.defineProperty(window, "location", {
    writable: true,
    value: { hash: "#access_token=AT&refresh_token=RT&type=recovery", search: "", pathname: "/" },
  });
});

describe("useResetPassword", () => {
  it("starts in initial state, transitions through consuming to ready", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
  });

  it("transitions to error EXPIRED on setSession expired", async () => {
    mockSetSession.mockResolvedValueOnce({ error: { message: "expired" } });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("EXPIRED");
  });

  it("submit posts to default endpoint and goes to success on 200", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    mockSignOut.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!ab"); });
    expect(result.current.state).toBe("success");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "NewPass1!ab" }),
        credentials: "same-origin",
      }),
    );
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("submit uses custom resetEndpoint when provided", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    mockSignOut.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useResetPassword({ resetEndpoint: "/custom/reset" }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!ab"); });
    expect(mockFetch).toHaveBeenCalledWith(
      "/custom/reset",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submit returns to ready with API_ERROR on non-ok response", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!ab"); });
    expect(result.current.state).toBe("ready");
    expect(result.current.errorCode).toBe("API_ERROR");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("submit returns to ready with API_ERROR when fetch throws", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!ab"); });
    expect(result.current.state).toBe("ready");
    expect(result.current.errorCode).toBe("API_ERROR");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("calls onError once when transitioning to error", async () => {
    const onError = vi.fn();
    mockSetSession.mockResolvedValueOnce({ error: { message: "expired" } });
    renderHook(() => useResetPassword({ onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("EXPIRED"));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("rejects type !== recovery with INVALID", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { hash: "#access_token=AT&refresh_token=RT&type=invite", search: "", pathname: "/" },
    });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("INVALID");
  });
});
