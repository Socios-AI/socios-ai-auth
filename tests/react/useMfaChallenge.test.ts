import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const listFactorsMock = vi.fn();
const challengeMock = vi.fn();
const verifyMock = vi.fn();

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      mfa: { listFactors: listFactorsMock, challenge: challengeMock, verify: verifyMock },
    },
  }),
}));

beforeEach(() => {
  listFactorsMock.mockReset();
  challengeMock.mockReset();
  verifyMock.mockReset();
});

describe("useMfaChallenge", () => {
  it("transitions ready → submitting → success on valid code", async () => {
    listFactorsMock.mockResolvedValue({
      data: { all: [{ id: "f1", factor_type: "totp", status: "verified" }], totp: [{ id: "f1", factor_type: "totp", status: "verified" }] },
      error: null,
    });
    challengeMock.mockResolvedValue({ data: { id: "ch1", expires_at: 9999 }, error: null });
    verifyMock.mockResolvedValue({ data: { access_token: "t", refresh_token: "r" }, error: null });

    const { useMfaChallenge } = await import("../../src/react/useMfaChallenge");
    const { result } = renderHook(() => useMfaChallenge());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      await result.current.submit("123456");
    });
    expect(result.current.state).toBe("success");
  });

  it("emits NO_FACTOR errorCode if user has no verified TOTP", async () => {
    listFactorsMock.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    });
    const { useMfaChallenge } = await import("../../src/react/useMfaChallenge");
    const { result } = renderHook(() => useMfaChallenge());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("NO_FACTOR");
  });

  it("maps verify failure to INVALID_CODE", async () => {
    listFactorsMock.mockResolvedValue({
      data: { all: [{ id: "f1", factor_type: "totp", status: "verified" }], totp: [{ id: "f1", factor_type: "totp", status: "verified" }] },
      error: null,
    });
    challengeMock.mockResolvedValue({ data: { id: "ch1", expires_at: 9999 }, error: null });
    verifyMock.mockResolvedValue({ data: null, error: { message: "Invalid TOTP code", status: 400 } });
    const { useMfaChallenge } = await import("../../src/react/useMfaChallenge");
    const { result } = renderHook(() => useMfaChallenge());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      await result.current.submit("000000");
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("INVALID_CODE");
  });

  it("submit() noops when state is 'error' (no factor)", async () => {
    listFactorsMock.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    const { useMfaChallenge } = await import("../../src/react/useMfaChallenge");
    const { result } = renderHook(() => useMfaChallenge());
    await waitFor(() => expect(result.current.state).toBe("error"));
    await act(async () => {
      await result.current.submit("123456");
    });
    expect(challengeMock).not.toHaveBeenCalled();
  });
});
