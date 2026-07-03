import { describe, it, expect } from "vitest";
import {
  decodeJwtPayload,
  sessionCookieName,
  readSessionCookie,
  extractAccessToken,
} from "../../src/edge/index";

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function makeCookies(entries: Record<string, string>) {
  return {
    get(name: string) {
      return name in entries ? { value: entries[name] } : undefined;
    },
  };
}

// ---- decodeJwtPayload: canonical admin/partners contract ----
describe("decodeJwtPayload", () => {
  it("decodes a valid JWT payload", () => {
    const tok = makeJwt({ sub: "u1", super_admin: true });
    expect(decodeJwtPayload(tok)).toEqual({ sub: "u1", super_admin: true });
  });

  it("returns {} on a base64url-valid but non-JSON payload", () => {
    // "not.a.jwt": middle segment "a" is valid base64url, decodes to garbage,
    // JSON.parse fails -> {} (admin/partners contract).
    expect(decodeJwtPayload("not.a.jwt")).toEqual({});
  });

  it("returns null on structural failure (missing segment / empty)", () => {
    expect(decodeJwtPayload("oneSegment")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("returns null on invalid base64url characters in the payload", () => {
    expect(decodeJwtPayload("aaa.!!!.bbb")).toBeNull();
  });

  it("decodes real-world ES256 claims identically to a Buffer reference (atob/Buffer parity)", () => {
    const claims = {
      sub: "c6d635cd-09d5-4868-9cd3-59a529c29f5f",
      email: "sysadmin@metamorph-ai.com",
      super_admin: true,
      aal: "aal2",
      exp: 1799999999,
      partner_id: "6c5ea5b6-0000-0000-0000-000000000000",
    };
    const tok = makeJwt(claims);
    // Reference = exactly what the previous admin/partners Buffer impl produced:
    // base64url -> base64 normalization, then Buffer base64 decode.
    const normalized = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bufferReference = JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
    expect(decodeJwtPayload(tok)).toEqual(bufferReference);
  });
});

// ---- sessionCookieName: SSO cookie name contract (fail-closed) ----
describe("sessionCookieName", () => {
  it("derives sb-<ref>-auth-token from the Supabase URL", () => {
    expect(sessionCookieName("https://axyssxqttfnbtawanasf.supabase.co")).toBe(
      "sb-axyssxqttfnbtawanasf-auth-token",
    );
  });

  it("returns null when the URL is undefined (fail-closed)", () => {
    expect(sessionCookieName(undefined)).toBeNull();
  });

  it("returns null when the URL is empty (fail-closed)", () => {
    expect(sessionCookieName("")).toBeNull();
  });
});

// ---- readSessionCookie: chunk reassembly ----
describe("readSessionCookie", () => {
  it("returns single base cookie when no chunks present", () => {
    const c = makeCookies({ "sb-x-auth-token": "single" });
    expect(readSessionCookie(c, "sb-x-auth-token")).toBe("single");
  });

  it("assembles chunks when .0 exists", () => {
    const c = makeCookies({
      "sb-x-auth-token.0": "part-a-",
      "sb-x-auth-token.1": "part-b",
    });
    expect(readSessionCookie(c, "sb-x-auth-token")).toBe("part-a-part-b");
  });

  it("returns null when nothing present", () => {
    expect(readSessionCookie(makeCookies({}), "sb-x-auth-token")).toBeNull();
  });
});

// ---- extractAccessToken: @supabase/ssr cookie value formats ----
describe("extractAccessToken", () => {
  it("returns bare token unchanged", () => {
    expect(extractAccessToken("eyJ.payload.sig")).toBe("eyJ.payload.sig");
  });

  it("extracts access_token from JSON object format (v0.5+)", () => {
    const session = JSON.stringify({
      access_token: "eyJ.real.jwt",
      refresh_token: "ref",
      expires_at: 123,
      user: { id: "u1" },
    });
    expect(extractAccessToken(session)).toBe("eyJ.real.jwt");
  });

  it("extracts access_token from base64-encoded JSON object", () => {
    const session = { access_token: "eyJ.real.jwt", refresh_token: "ref" };
    const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
    expect(extractAccessToken(encoded)).toBe("eyJ.real.jwt");
  });

  it("extracts access_token from JSON array format (legacy)", () => {
    const arr = JSON.stringify(["eyJ.legacy.jwt", "ref", null, null, 123]);
    expect(extractAccessToken(arr)).toBe("eyJ.legacy.jwt");
  });

  it("extracts access_token from base64-encoded JSON array (legacy)", () => {
    const arr = ["eyJ.legacy.jwt", "ref", null, null, 123];
    const encoded = "base64-" + Buffer.from(JSON.stringify(arr)).toString("base64");
    expect(extractAccessToken(encoded)).toBe("eyJ.legacy.jwt");
  });

  it("falls back to raw cookie when JSON is malformed", () => {
    expect(extractAccessToken("base64-not-valid-base64!!!")).toBe("base64-not-valid-base64!!!");
  });
});
