import { describe, it, expect } from "vitest";
import {
  hasAppAccess,
  getAppMembership,
  getAppMemberships,
  hasActiveSubscription,
  getActiveSubscriptions,
  readMembershipsCompat,
} from "../src/index";
import type { AppScopedClaims } from "../src/types";

const baseClaims: AppScopedClaims = {
  super_admin: false,
  tier: null,
  partner_id: null,
  mfa_enrolled: false,
  locale: "pt-BR",
  memberships: [
    { app_slug: "admin", org_id: null, role: "admin", permissions: {} },
    { app_slug: "case-predictor", org_id: null, role: "pro", permissions: {} },
    { app_slug: "case-predictor", org_id: "00000000-0000-0000-0000-000000000001", role: "viewer", permissions: {} },
  ],
  subscriptions: [
    { app_slug: "case-predictor", plan_slug: "pro_monthly", status: "active", current_period_end: "2026-06-05T00:00:00Z", features: {} },
  ],
};

describe("hasAppAccess", () => {
  it("returns true when membership exists", () => {
    expect(hasAppAccess(baseClaims, "admin")).toBe(true);
  });
  it("returns false when no membership", () => {
    expect(hasAppAccess(baseClaims, "partners")).toBe(false);
  });
  it("returns false for null claims", () => {
    expect(hasAppAccess(null, "admin")).toBe(false);
  });
});

describe("getAppMembership", () => {
  it("returns first membership matching app_slug", () => {
    const m = getAppMembership(baseClaims, "case-predictor");
    expect(m?.role).toBe("pro");
  });
  it("returns null when no match", () => {
    expect(getAppMembership(baseClaims, "partners")).toBeNull();
  });
  it("returns null for null claims", () => {
    expect(getAppMembership(null, "admin")).toBeNull();
  });
});

describe("getAppMemberships", () => {
  it("returns all memberships matching app_slug", () => {
    const list = getAppMemberships(baseClaims, "case-predictor");
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.role).sort()).toEqual(["pro", "viewer"]);
  });
  it("returns empty array when no match", () => {
    expect(getAppMemberships(baseClaims, "partners")).toEqual([]);
  });
  it("returns empty array for null claims", () => {
    expect(getAppMemberships(null, "admin")).toEqual([]);
  });
});

describe("hasActiveSubscription", () => {
  it("returns true when subscription exists", () => {
    expect(hasActiveSubscription(baseClaims, "case-predictor")).toBe(true);
  });
  it("returns false when no subscription", () => {
    expect(hasActiveSubscription(baseClaims, "admin")).toBe(false);
  });
});

describe("getActiveSubscriptions", () => {
  it("returns subscriptions for app_slug", () => {
    const list = getActiveSubscriptions(baseClaims, "case-predictor");
    expect(list).toHaveLength(1);
    expect(list[0]?.plan_slug).toBe("pro_monthly");
  });
  it("returns empty array when no match", () => {
    expect(getActiveSubscriptions(baseClaims, "partners")).toEqual([]);
  });
});

describe("readMembershipsCompat", () => {
  it("returns [] for null input", () => {
    expect(readMembershipsCompat(null)).toEqual([]);
  });
  it("returns [] for missing memberships key", () => {
    expect(readMembershipsCompat({})).toEqual([]);
  });
  it("returns [] when memberships is not array", () => {
    expect(readMembershipsCompat({ memberships: "nope" })).toEqual([]);
  });
  it("returns new shape rows when every row has app_slug", () => {
    const input = { memberships: [{ app_slug: "admin", org_id: null, role: "admin", permissions: {} }] };
    expect(readMembershipsCompat(input)).toEqual(input.memberships);
  });
  it("returns [] (fail-closed) when legacy shape (no app_slug)", () => {
    const input = { memberships: [{ org_id: null, role: "admin", permissions: {} }] };
    expect(readMembershipsCompat(input)).toEqual([]);
  });
  it("returns [] when shape is mixed (paranoia)", () => {
    const input = {
      memberships: [
        { app_slug: "admin", org_id: null, role: "admin", permissions: {} },
        { org_id: null, role: "x", permissions: {} },
      ],
    };
    expect(readMembershipsCompat(input)).toEqual([]);
  });
  it("returns [] for empty array (early return)", () => {
    expect(readMembershipsCompat({ memberships: [] })).toEqual([]);
  });
});
