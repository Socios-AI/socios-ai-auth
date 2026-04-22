import { describe, it, expect } from "vitest";
import { passwordSchema, resetFormSchema } from "../src/validation";

describe("passwordSchema", () => {
  it("rejects passwords shorter than 10 chars", () => {
    const r = passwordSchema.safeParse("Aa1!short");
    expect(r.success).toBe(false);
  });
  it("rejects passwords with no lowercase", () => {
    const r = passwordSchema.safeParse("ABCDEFGH1!");
    expect(r.success).toBe(false);
  });
  it("rejects passwords with no uppercase", () => {
    const r = passwordSchema.safeParse("abcdefgh1!");
    expect(r.success).toBe(false);
  });
  it("rejects passwords with no digit", () => {
    const r = passwordSchema.safeParse("Abcdefgh!j");
    expect(r.success).toBe(false);
  });
  it("rejects passwords with no symbol", () => {
    const r = passwordSchema.safeParse("Abcdefgh1k");
    expect(r.success).toBe(false);
  });
  it("accepts valid passwords", () => {
    const r = passwordSchema.safeParse("ValidPass1!");
    expect(r.success).toBe(true);
  });
});

describe("resetFormSchema", () => {
  it("rejects when password and confirm differ", () => {
    const r = resetFormSchema.safeParse({ password: "ValidPass1!", confirm: "Different1!" });
    expect(r.success).toBe(false);
  });
  it("accepts when password and confirm match and pass schema", () => {
    const r = resetFormSchema.safeParse({ password: "ValidPass1!", confirm: "ValidPass1!" });
    expect(r.success).toBe(true);
  });
});
