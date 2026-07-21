import { describe, expect, it } from "vitest";
import { ApiError, mapPostgresError } from "./errors";

describe("API v2 error constructors (additive to the v1 contract)", () => {
  it("teamRequired produces a stable TEAM_REQUIRED/403", () => {
    const err = ApiError.teamRequired();
    expect(err.code).toBe("TEAM_REQUIRED");
    expect(err.status).toBe(403);
  });

  it("notFoundV2 (NOT_FOUND) is distinct from the v1 notFound (RESOURCE_NOT_FOUND)", () => {
    expect(ApiError.notFoundV2("Board").code).toBe("NOT_FOUND");
    expect(ApiError.notFound("Board").code).toBe("RESOURCE_NOT_FOUND");
  });

  it("toBody() round-trips code/message/details for a v2 code", () => {
    const err = ApiError.resourceConflict("Session already live.", { session_id: "abc" });
    expect(err.toBody()).toEqual({ error: { code: "RESOURCE_CONFLICT", message: "Session already live.", details: { session_id: "abc" } } });
  });
});

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
