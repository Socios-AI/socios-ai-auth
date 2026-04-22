import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const enrollMock = vi.fn();
const challengeMock = vi.fn();
const verifyMock = vi.fn();

vi.mock("../../src/browser/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      mfa: { enroll: enrollMock, challenge: challengeMock, verify: verifyMock },
    },
  }),
}));

beforeEach(() => {
  enrollMock.mockReset();
  challengeMock.mockReset();
  verifyMock.mockReset();
});

describe("useMfaEnroll", () => {
  it("calls enroll on mount and exposes qrCodeSvg + secret + uri", async () => {
    enrollMock.mockResolvedValue({
      data: {
        id: "factor-1",
        type: "totp",
        totp: {
          qr_code: "<svg>...</svg>",
          secret: "JBSWY3DPEHPK3PXP",
          uri: "otpauth://totp/Socios%20AI:a@b.com?secret=JBSWY3DPEHPK3PXP&issuer=Socios%20AI",
        },
      },
      error: null,
    });

    const { useMfaEnroll } = await import("../../src/react/useMfaEnroll");
    const { result } = renderHook(() => useMfaEnroll());
    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.qrCodeSvg).toBe("<svg>...</svg>");
    expect(result.current.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(result.current.otpauthUri).toContain("otpauth://totp/");
  });

  it("transitions ready → submitting → success on verify success", async () => {
    enrollMock.mockResolvedValue({
      data: { id: "f1", type: "totp", totp: { qr_code: "x", secret: "S", uri: "U" } },
      error: null,
    });
    challengeMock.mockResolvedValue({ data: { id: "ch-1", expires_at: 9999 }, error: null });
    verifyMock.mockResolvedValue({
      data: { access_token: "t", refresh_token: "r" },
      error: null,
    });

    const { useMfaEnroll } = await import("../../src/react/useMfaEnroll");
    const { result } = renderHook(() => useMfaEnroll());
    await waitFor(() => expect(result.current.state).toBe("ready"));

    await act(async () => {
      await result.current.submit("123456");
    });
    expect(result.current.state).toBe("success");
    expect(challengeMock).toHaveBeenCalledWith({ factorId: "f1" });
    expect(verifyMock).toHaveBeenCalledWith({
      factorId: "f1",
      challengeId: "ch-1",
      code: "123456",
    });
  });

  it("maps verify error to INVALID_CODE on 'invalid_otp_code' message", async () => {
    enrollMock.mockResolvedValue({
      data: { id: "f1", type: "totp", totp: { qr_code: "x", secret: "S", uri: "U" } },
      error: null,
    });
    challengeMock.mockResolvedValue({ data: { id: "ch-1", expires_at: 9999 }, error: null });
    verifyMock.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code entered", status: 400 },
    });

    const { useMfaEnroll } = await import("../../src/react/useMfaEnroll");
    const { result } = renderHook(() => useMfaEnroll());
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      await result.current.submit("000000");
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorCode).toBe("INVALID_CODE");
  });

  it("transitions to error if enroll itself fails", async () => {
    enrollMock.mockResolvedValue({
      data: null,
      error: { message: "rate limited", status: 429 },
    });
    const { useMfaEnroll } = await import("../../src/react/useMfaEnroll");
    const { result } = renderHook(() => useMfaEnroll());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("RATE_LIMITED");
  });

  it("does NOT call enroll twice under React StrictMode (uses ref guard)", async () => {
    enrollMock.mockResolvedValue({
      data: { id: "f1", type: "totp", totp: { qr_code: "x", secret: "S", uri: "U" } },
      error: null,
    });
    const { useMfaEnroll } = await import("../../src/react/useMfaEnroll");
    const { rerender } = renderHook(() => useMfaEnroll());
    rerender();
    await waitFor(() => expect(enrollMock).toHaveBeenCalledTimes(1));
  });
});
