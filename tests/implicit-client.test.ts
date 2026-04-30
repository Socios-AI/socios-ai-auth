import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockCreateClient = vi.hoisted(() => vi.fn(() => ({ mock: "implicit-client" })));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

import { getSupabaseImplicitClient } from "../src/browser/implicit-client";

describe("getSupabaseImplicitClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockCreateClient.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses opts override when provided", () => {
    getSupabaseImplicitClient({ url: "https://override.supabase.co", anonKey: "override-key" });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient.mock.calls[0][0]).toBe("https://override.supabase.co");
    expect(mockCreateClient.mock.calls[0][1]).toBe("override-key");
  });

  it("falls back to NEXT_PUBLIC_* env vars", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://nextpub.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "nextpub-key";
    getSupabaseImplicitClient();
    expect(mockCreateClient.mock.calls[0][0]).toBe("https://nextpub.supabase.co");
    expect(mockCreateClient.mock.calls[0][1]).toBe("nextpub-key");
  });

  it("falls back to SUPABASE_* env vars when NEXT_PUBLIC_* missing", () => {
    process.env.SUPABASE_URL = "https://plain.supabase.co";
    process.env.SUPABASE_ANON_KEY = "plain-key";
    getSupabaseImplicitClient();
    expect(mockCreateClient.mock.calls[0][0]).toBe("https://plain.supabase.co");
  });

  it("throws when no env vars and no opts", () => {
    expect(() => getSupabaseImplicitClient()).toThrow(/Missing Supabase URL or anon key/);
  });

  it("configures auth with implicit flow and disabled session persistence", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    getSupabaseImplicitClient();
    expect(mockCreateClient.mock.calls[0][2]).toEqual({
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  });
});
