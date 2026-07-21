import { describe, expect, it } from "vitest";
import { successEnvelope, errorEnvelope, isErrorEnvelope, isSuccessEnvelope } from "./envelopes";

describe("successEnvelope", () => {
  it("wraps data with api_version and request_id", () => {
    const envelope = successEnvelope({ foo: "bar" }, "req-1");
    expect(envelope).toEqual({ data: { foo: "bar" }, meta: { api_version: "2", request_id: "req-1" } });
  });

  it("merges extra meta fields", () => {
    const envelope = successEnvelope([1, 2], "req-1", { total: 2 });
    expect(envelope.meta.total).toBe(2);
  });
});

describe("errorEnvelope", () => {
  it("includes details only when present", () => {
    const withoutDetails = errorEnvelope({ code: "VALIDATION_FAILED", message: "bad" }, "req-1");
    expect(withoutDetails).toEqual({ error: { code: "VALIDATION_FAILED", message: "bad", request_id: "req-1" } });

    const withDetails = errorEnvelope({ code: "VALIDATION_FAILED", message: "bad", details: { field: "x" } }, "req-1");
    expect(withDetails.error.details).toEqual({ field: "x" });
  });
});

describe("isErrorEnvelope / isSuccessEnvelope", () => {
  it("distinguishes the two shapes", () => {
    expect(isErrorEnvelope({ error: { code: "X", message: "y" } })).toBe(true);
    expect(isErrorEnvelope({ data: {}, meta: {} })).toBe(false);
    expect(isSuccessEnvelope({ data: {}, meta: {} })).toBe(true);
    expect(isSuccessEnvelope({ error: {} })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isErrorEnvelope(null)).toBe(false);
    expect(isErrorEnvelope("nope")).toBe(false);
    expect(isSuccessEnvelope(undefined)).toBe(false);
  });
});
