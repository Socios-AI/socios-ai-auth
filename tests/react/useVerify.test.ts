import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVerify } from "../../src/react/useVerify";

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "../../src/browser/client";

const mockSetSession = vi.fn();
const mockVerifyOtp = vi.fn();

beforeEach(() => {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: { setSession: mockSetSession, verifyOtp: mockVerifyOtp },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  mockSetSession.mockReset();
  mockVerifyOtp.mockReset();
});

function setLocation(hash: string, search: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { hash, search, pathname: "/" },
  });
}

describe("useVerify", () => {
  it("verifies signup via hash, transitions to success", async () => {
    setLocation("#access_token=AT&refresh_token=RT&type=signup", "");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(result.current.resolvedType).toBe("signup");
  });

  it("verifies email_change via hash", async () => {
    setLocation("#access_token=AT&refresh_token=RT&type=email_change", "");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(result.current.resolvedType).toBe("email_change");
  });

  it("verifies email_change_new via hash, exposes resolvedType as email_change_new", async () => {
    setLocation("#access_token=AT&refresh_token=RT&type=email_change_new", "");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(result.current.resolvedType).toBe("email_change_new");
  });

  it("verifies signup via query token_hash, calls verifyOtp", async () => {
    setLocation("", "?token_hash=h123&type=signup");
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "h123", type: "signup" });
  });

  it("maps email_change_new to email_change for verifyOtp call (query path)", async () => {
    setLocation("", "?token_hash=h123&type=email_change_new");
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "h123", type: "email_change" });
    expect(result.current.resolvedType).toBe("email_change_new");
  });

  it("rejects type=recovery with INVALID", async () => {
    setLocation("#access_token=AT&refresh_token=RT&type=recovery", "");
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("INVALID");
  });

  it("transitions to EXPIRED on setSession expired", async () => {
    setLocation("#access_token=AT&refresh_token=RT&type=signup", "");
    mockSetSession.mockResolvedValueOnce({ error: { message: "expired" } });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("EXPIRED");
  });

  it("transitions to MISSING_TOKEN with no hash or query", async () => {
    setLocation("", "");
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("MISSING_TOKEN");
  });

  it("transitions to INVALID on verifyOtp error", async () => {
    setLocation("", "?token_hash=h&type=signup");
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: "bad otp" } });
    const { result } = renderHook(() => useVerify());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("INVALID");
  });

  it("calls onError once on error", async () => {
    setLocation("", "");
    const onError = vi.fn();
    renderHook(() => useVerify({ onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("MISSING_TOKEN"));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
