import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const signInMock = vi.fn();
const listFactorsMock = vi.fn();

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: signInMock,
      mfa: { listFactors: listFactorsMock },
    },
  }),
}));

beforeEach(() => {
  signInMock.mockReset();
  listFactorsMock.mockReset();
});

describe("useLogin", () => {
  it("starts in idle state", async () => {
    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    expect(result.current.state).toBe("idle");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.mfaRequired).toBe(false);
  });

  it("transitions idle → submitting → success when no MFA enrolled", async () => {
    signInMock.mockResolvedValue({
      data: {
        user: { id: "u1" },
        session: { access_token: "tok", refresh_token: "ref" },
      },
      error: null,
    });
    listFactorsMock.mockResolvedValue({ data: { all: [], totp: [] }, error: null });

    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    await act(async () => {
      await result.current.submit("a@b.com", "pwd123");
    });
    expect(result.current.state).toBe("success");
    expect(result.current.mfaRequired).toBe(false);
  });

  it("transitions to mfa-required when user has verified TOTP factor", async () => {
    signInMock.mockResolvedValue({
      data: {
        user: { id: "u1" },
        session: {
          access_token: "tok",
          refresh_token: "ref",
        },
      },
      error: null,
    });
    listFactorsMock.mockResolvedValue({
      data: {
        all: [{ id: "f1", factor_type: "totp", status: "verified" }],
        totp: [{ id: "f1", factor_type: "totp", status: "verified" }],
      },
      error: null,
    });

    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    await act(async () => {
      await result.current.submit("a@b.com", "pwd123");
    });
    expect(result.current.state).toBe("mfa-required");
    expect(result.current.mfaRequired).toBe(true);
  });

  it("maps invalid_credentials AuthApiError to INVALID_CREDENTIALS errorCode", async () => {
    signInMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "Invalid login credentials", status: 400, code: "invalid_credentials" },
    });
    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    await act(async () => {
      await result.current.submit("a@b.com", "wrong");
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it("maps email_not_confirmed to EMAIL_NOT_CONFIRMED", async () => {
    signInMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "Email not confirmed", status: 400, code: "email_not_confirmed" },
    });
    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    await act(async () => {
      await result.current.submit("a@b.com", "pwd");
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("maps 429 status to RATE_LIMITED", async () => {
    signInMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "Too many requests", status: 429 },
    });
    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    await act(async () => {
      await result.current.submit("a@b.com", "pwd");
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("RATE_LIMITED");
  });

  it("maps unknown error to API_ERROR", async () => {
    signInMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "kaboom", status: 500 },
    });
    const { useLogin } = await import("../../src/react/useLogin");
    const { result } = renderHook(() => useLogin());
    await act(async () => {
      await result.current.submit("a@b.com", "pwd");
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("API_ERROR");
  });
});
