import { describe, expect, it } from "vitest";
import { mapPostgresError } from "./errors";

describe("mapPostgresError", () => {
  it("maps a pairing-code unique violation", () => {
    const err = mapPostgresError({ code: "23505", message: 'duplicate key value violates unique constraint "screen_pairing_codes_code_hash_key"' });
    expect(err.code).toBe("PAIRING_CODE_INVALID");
    expect(err.status).toBe(409);
  });

  it("maps the one-live-session-per-screen unique violation", () => {
    const err = mapPostgresError({ code: "23505", message: 'duplicate key value violates unique constraint "one_live_session_per_screen_idx"' });
    expect(err.code).toBe("SCREEN_ALREADY_ACTIVE");
  });

  it("maps a foreign key violation to RESOURCE_NOT_FOUND", () => {
    const err = mapPostgresError({ code: "23503", message: "violates foreign key constraint" });
    expect(err.code).toBe("RESOURCE_NOT_FOUND");
    expect(err.status).toBe(404);
  });

  it("maps the entitlement trigger message to SCREEN_LIMIT_REACHED", () => {
    const err = mapPostgresError(new Error("This plan allows at most 1 screen(s) per session"));
    expect(err.code).toBe("SCREEN_LIMIT_REACHED");
    expect(err.status).toBe(409);
  });

  it("maps the draft-session trigger message to SESSION_NOT_DRAFT", () => {
    const err = mapPostgresError(new Error("A display session must be created as a draft before it can be started"));
    expect(err.code).toBe("SESSION_NOT_DRAFT");
  });

  it("maps the single-enabled-screen trigger message to LAYOUT_INVALID", () => {
    const err = mapPostgresError(new Error("Single display mode requires exactly one enabled screen"));
    expect(err.code).toBe("LAYOUT_INVALID");
  });

  it("falls back to INTERNAL_ERROR for unrecognized errors", () => {
    const err = mapPostgresError(new Error("some completely unrelated failure"));
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.status).toBe(500);
  });
});
