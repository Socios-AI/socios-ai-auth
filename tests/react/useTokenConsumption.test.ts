import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTokenConsumption } from "../../src/react/useTokenConsumption";

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

import { getSupabaseBrowserClient } from "../../src/browser/client";

// NOTE: helpers only set their own field (hash or search) so that calling
// setHash + setQuery in the same test leaves both populated. This is required
// by the "hash takes precedence" test below.
function setHash(hash: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, hash, pathname: "/", href: `http://localhost/${hash}` },
  });
}

function setQuery(search: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search, pathname: "/", href: `http://localhost/?${search}` },
  });
}

const mockSetSession = vi.fn();
const mockVerifyOtp = vi.fn();
const mockExchangeCodeForSession = vi.fn();

beforeEach(() => {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: {
      setSession: mockSetSession,
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  mockSetSession.mockReset();
  mockVerifyOtp.mockReset();
  mockExchangeCodeForSession.mockReset();
});

afterEach(() => {
  setHash("");
  setQuery("");
});

describe("useTokenConsumption", () => {
  it("transitions to MISSING_TOKEN when neither hash nor query present", async () => {
    setHash("");
    setQuery("");
    const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("MISSING_TOKEN");
  });

  it("transitions to ready on valid hash tokens (calls setSession)", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=recovery");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: "AT", refresh_token: "RT" });
    expect(result.current.resolvedType).toBe("recovery");
  });

  it("transitions to INVALID when hash type not in acceptedTypes", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=signup");
    const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("INVALID");
  });

  it("transitions to EXPIRED when setSession returns expired error", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=recovery");
    mockSetSession.mockResolvedValueOnce({ error: { message: "Token has expired or is invalid" } });
    const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("EXPIRED");
  });

  it("transitions to ready on valid query token (calls verifyOtp)", async () => {
    setQuery("token_hash=hash123&type=signup");
    mockVerifyOtp.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["signup", "email_change"] }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "hash123", type: "signup" });
    expect(result.current.resolvedType).toBe("signup");
  });

  it("hash takes precedence when both hash and query present (source=auto)", async () => {
    setHash("#access_token=AT&refresh_token=RT&type=recovery");
    setQuery("token_hash=ignored&type=signup");
    mockSetSession.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(mockSetSession).toHaveBeenCalled();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  describe("PKCE flow (?code=)", () => {
    it("calls exchangeCodeForSession with the code and resolves to acceptedTypes[0]", async () => {
      setQuery("code=4dc39817-1aad-4c10-9c3f-a2edd70fd38b");
      mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
      await waitFor(() => expect(result.current.state).toBe("ready"));
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith(
        "4dc39817-1aad-4c10-9c3f-a2edd70fd38b",
      );
      expect(result.current.resolvedType).toBe("recovery");
    });

    it("transitions to EXPIRED when exchangeCodeForSession returns expired error", async () => {
      setQuery("code=expired-code");
      mockExchangeCodeForSession.mockResolvedValueOnce({
        error: { message: "auth code is invalid or expired" },
      });
      const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
      await waitFor(() => expect(result.current.state).toBe("error"));
      expect(result.current.errorCode).toBe("EXPIRED");
    });

    it("uses ?type= when present and validates against acceptedTypes", async () => {
      setQuery("code=abc&type=invite");
      mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() =>
        useTokenConsumption({ acceptedTypes: ["invite", "recovery"] }),
      );
      await waitFor(() => expect(result.current.state).toBe("ready"));
      expect(result.current.resolvedType).toBe("invite");
    });

    it("rejects when ?type= is set but not in acceptedTypes", async () => {
      setQuery("code=abc&type=signup");
      const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
      await waitFor(() => expect(result.current.state).toBe("error"));
      expect(result.current.errorCode).toBe("INVALID");
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });
  });

  describe("error redirect (?error=)", () => {
    it("classifies otp_expired as EXPIRED", async () => {
      setQuery(
        "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      );
      const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
      await waitFor(() => expect(result.current.state).toBe("error"));
      expect(result.current.errorCode).toBe("EXPIRED");
    });

    it("classifies generic error as INVALID", async () => {
      setQuery("error=access_denied&error_description=something+went+wrong");
      const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
      await waitFor(() => expect(result.current.state).toBe("error"));
      expect(result.current.errorCode).toBe("INVALID");
    });

    it("also reads error from hash (legacy implicit flow shape)", async () => {
      setHash("#error=access_denied&error_code=otp_expired&error_description=expired");
      const { result } = renderHook(() => useTokenConsumption({ acceptedTypes: ["recovery"] }));
      await waitFor(() => expect(result.current.state).toBe("error"));
      expect(result.current.errorCode).toBe("EXPIRED");
    });
  });
});
