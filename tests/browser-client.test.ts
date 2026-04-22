import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSupabaseBrowserClient } from "../src/browser/client";

describe("getSupabaseBrowserClient env resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses opts override when provided", () => {
    const client = getSupabaseBrowserClient({ url: "https://override.supabase.co", anonKey: "override-key" });
    expect(client).toBeDefined();
  });

  it("falls back to NEXT_PUBLIC_* env vars", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://nextpub.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "nextpub-key";
    const client = getSupabaseBrowserClient();
    expect(client).toBeDefined();
  });

  it("falls back to SUPABASE_* env vars when NEXT_PUBLIC_* missing", () => {
    process.env.SUPABASE_URL = "https://plain.supabase.co";
    process.env.SUPABASE_ANON_KEY = "plain-key";
    const client = getSupabaseBrowserClient();
    expect(client).toBeDefined();
  });

  it("throws when no env vars and no opts", () => {
    expect(() => getSupabaseBrowserClient()).toThrow(/Missing Supabase URL or anon key/);
  });
});
