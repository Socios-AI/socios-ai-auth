import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useResetPassword } from "../../src/react/useResetPassword";

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "../../src/browser/client";

const mockSetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

beforeEach(() => {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: {
      setSession: mockSetSession,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  mockSetSession.mockReset();
  mockUpdateUser.mockReset();
  mockSignOut.mockReset();
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

  it("submit transitions ready -> submitting -> success on success", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    mockSignOut.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!"); });
    expect(result.current.state).toBe("success");
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "NewPass1!" });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("submit returns to ready with API_ERROR on updateUser failure", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockUpdateUser.mockResolvedValueOnce({ error: { message: "boom" } });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!"); });
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
