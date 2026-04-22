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

beforeEach(() => {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: {
      setSession: mockSetSession,
      verifyOtp: mockVerifyOtp,
    },
  } as unknown as ReturnType<typeof getSupabaseBrowserClient>);
  mockSetSession.mockReset();
  mockVerifyOtp.mockReset();
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
});
