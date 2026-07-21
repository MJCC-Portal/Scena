import { describe, expect, it } from "vitest";
import { generateRequestId, resolveRequestId, isValidRequestId } from "./request";

describe("generateRequestId", () => {
  it("produces a valid UUID", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(isValidRequestId(id)).toBe(true);
  });
});

describe("resolveRequestId", () => {
  it("accepts a safe caller-supplied ID", () => {
    expect(resolveRequestId("abc-123.foo_bar")).toBe("abc-123.foo_bar");
  });

  it("generates a fresh ID when none is supplied", () => {
    const id = resolveRequestId(null);
    expect(isValidRequestId(id)).toBe(true);
  });

  it("rejects an unsafe caller-supplied ID (too long)", () => {
    const tooLong = "a".repeat(101);
    const id = resolveRequestId(tooLong);
    expect(id).not.toBe(tooLong);
    expect(isValidRequestId(id)).toBe(true);
  });

  it("rejects an unsafe caller-supplied ID (bad characters)", () => {
    const id = resolveRequestId("<script>alert(1)</script>");
    expect(isValidRequestId(id)).toBe(true);
    expect(id).not.toContain("<");
  });
});
