import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSetPassword } from "../../src/react/useSetPassword";

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "../../src/browser/client";

const mockSetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

beforeEach(() => {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: { setSession: mockSetSession, updateUser: mockUpdateUser, signOut: mockSignOut },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  mockSetSession.mockReset();
  mockUpdateUser.mockReset();
  mockSignOut.mockReset();
});

function setHash(hash: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { hash, search: "", pathname: "/" },
  });
}

describe("useSetPassword", () => {
  it("accepts type=invite and reaches ready", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=invite");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.resolvedType).toBe("invite");
  });

  it("accepts type=recovery and reaches ready", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=recovery");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.resolvedType).toBe("recovery");
  });

  it("rejects type=signup with INVALID", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=signup");
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("INVALID");
  });

  it("submit transitions to success", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=invite");
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    mockSignOut.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!"); });
    expect(result.current.state).toBe("success");
  });

  it("submit returns to ready with API_ERROR on updateUser failure", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=invite");
    mockSetSession.mockResolvedValueOnce({ error: null });
    mockUpdateUser.mockResolvedValueOnce({ error: { message: "boom" } });
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => { await result.current.submit("NewPass1!"); });
    expect(result.current.state).toBe("ready");
    expect(result.current.errorCode).toBe("API_ERROR");
  });

  it("EXPIRED on setSession expired error", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=invite");
    mockSetSession.mockResolvedValueOnce({ error: { message: "Token has expired" } });
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("EXPIRED");
  });

  it("MISSING_TOKEN on no hash and no query", async () => {
    setHash("");
    const { result } = renderHook(() => useSetPassword());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("MISSING_TOKEN");
  });

  it("calls onError once on error transition", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=signup");
    const onError = vi.fn();
    renderHook(() => useSetPassword({ onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("INVALID"));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
