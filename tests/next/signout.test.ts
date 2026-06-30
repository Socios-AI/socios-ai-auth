import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAll } = vi.hoisted(() => ({ mockGetAll: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: () => ({ getAll: mockGetAll }) }));

import { signOutResponse } from "../../src/next/signout";

describe("signOutResponse", () => {
  beforeEach(() => {
    mockGetAll.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyzref.supabase.co";
  });

  it("redirects to the Identity login (303) carrying the `from`", async () => {
    mockGetAll.mockReturnValue([]);
    const res = await signOutResponse({ from: "https://admin.sociosai.com/" });
    expect(res.status).toBe(303);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("id.sociosai.com/login");
    expect(loc).toContain("admin.sociosai.com");
  });

  it("clears base + present chunks (incl. >5) on the RETURNED response, with .sociosai.com domain", async () => {
    mockGetAll.mockReturnValue([
      { name: "sb-xyzref-auth-token.0", value: "a" },
      { name: "sb-xyzref-auth-token.7", value: "b" },
      { name: "unrelated", value: "c" },
    ]);
    const res = await signOutResponse({ from: "https://partners.sociosai.com/" });
    for (const name of ["sb-xyzref-auth-token", "sb-xyzref-auth-token.0", "sb-xyzref-auth-token.7"]) {
      const ck = res.cookies.get(name);
      expect(ck?.value).toBe("");
      expect(ck?.maxAge).toBe(0);
      expect(ck?.domain).toBe(".sociosai.com");
    }
    expect(res.cookies.get("unrelated")).toBeUndefined();
  });
});
