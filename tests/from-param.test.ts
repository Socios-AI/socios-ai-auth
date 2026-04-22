import { describe, it, expect } from "vitest";
import { validateFromParam, deriveAppName } from "../src/from-param";

describe("validateFromParam", () => {
  it("returns invalid for null", () => {
    expect(validateFromParam(null)).toEqual({ valid: false });
  });
  it("returns invalid for undefined", () => {
    expect(validateFromParam(undefined)).toEqual({ valid: false });
  });
  it("returns invalid for empty string", () => {
    expect(validateFromParam("")).toEqual({ valid: false });
  });
  it("returns invalid for whitespace", () => {
    expect(validateFromParam("   ")).toEqual({ valid: false });
  });
  it("returns invalid for non-URL string", () => {
    expect(validateFromParam("not-a-url")).toEqual({ valid: false });
  });
  it("returns invalid for http (non-https)", () => {
    expect(validateFromParam("http://sociosai.com")).toEqual({ valid: false });
  });
  it("returns invalid for URL with credentials", () => {
    expect(validateFromParam("https://user:pass@sociosai.com")).toEqual({ valid: false });
  });
  it("returns invalid for foreign domain", () => {
    expect(validateFromParam("https://example.com")).toEqual({ valid: false });
  });
  it("returns valid for sociosai.com", () => {
    const r = validateFromParam("https://sociosai.com");
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.url.hostname).toBe("sociosai.com");
  });
  it("returns valid for subdomain of sociosai.com", () => {
    const r = validateFromParam("https://case-predictor.sociosai.com");
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.url.hostname).toBe("case-predictor.sociosai.com");
  });
});

describe("deriveAppName", () => {
  it("returns null for invalid input", () => {
    expect(deriveAppName(null)).toBeNull();
    expect(deriveAppName("not-a-url")).toBeNull();
  });
  it("returns 'Sócios AI' for root domain", () => {
    expect(deriveAppName("https://sociosai.com")).toBe("Sócios AI");
  });
  it("returns uppercase subdomain label for subdomain", () => {
    expect(deriveAppName("https://case-predictor.sociosai.com")).toBe("CASE-PREDICTOR");
    expect(deriveAppName("https://admin.sociosai.com")).toBe("ADMIN");
  });
});
