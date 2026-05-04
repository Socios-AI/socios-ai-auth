import { describe, expect, it } from "vitest";
import type { PartnerClaims, SuperAdminClaims } from "../src";
import { getPartnerIdFromClaims } from "../src";

describe("PartnerClaims", () => {
  it("getPartnerIdFromClaims returns null for null input", () => {
    expect(getPartnerIdFromClaims(null)).toBe(null);
  });

  it("getPartnerIdFromClaims returns partner_id when present", () => {
    const claims = { partner_id: "abc-123", super_admin: false } as PartnerClaims;
    expect(getPartnerIdFromClaims(claims)).toBe("abc-123");
  });

  it("getPartnerIdFromClaims returns null when partner_id is null", () => {
    const claims = { partner_id: null, super_admin: false } as PartnerClaims;
    expect(getPartnerIdFromClaims(claims)).toBe(null);
  });

  it("PartnerClaims is assignable from SuperAdminClaims+partner_id", () => {
    const sa: SuperAdminClaims = { super_admin: true } as SuperAdminClaims;
    const pc: PartnerClaims = { ...sa, partner_id: "x" };
    expect(pc.partner_id).toBe("x");
  });
});
