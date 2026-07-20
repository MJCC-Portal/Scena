import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import {
  parsePagination,
  requireCronOrOnce,
  requireDisplayMode,
  requirePairingCode,
  requirePercent,
  requirePrice,
  requireRole,
  requireRotation,
  requireSlug,
  requireSortOrder,
  requireUuid,
} from "./validation";

describe("requireUuid", () => {
  it("accepts a valid uuid", () => {
    expect(requireUuid("640a88d6-af64-4877-b64c-c91981d2ed92", "id")).toBe("640a88d6-af64-4877-b64c-c91981d2ed92");
  });
  it("rejects a non-uuid", () => {
    expect(() => requireUuid("not-a-uuid", "id")).toThrow(ApiError);
  });
});

describe("requireSlug", () => {
  it("accepts lowercase-with-hyphens", () => expect(requireSlug("front-counter")).toBe("front-counter"));
  it("rejects uppercase", () => expect(() => requireSlug("Front-Counter")).toThrow(ApiError));
  it("rejects leading hyphen", () => expect(() => requireSlug("-bad")).toThrow(ApiError));
});

describe("requireRole / requireDisplayMode", () => {
  it("accepts the four schema roles", () => {
    for (const r of ["owner", "admin", "operator", "viewer"]) expect(requireRole(r)).toBe(r);
  });
  it("rejects an unknown role", () => expect(() => requireRole("superadmin")).toThrow(ApiError));
  it("accepts the four display modes", () => {
    for (const m of ["independent", "duplicate", "extend", "single"]) expect(requireDisplayMode(m)).toBe(m);
  });
  it("rejects an unknown display mode", () => expect(() => requireDisplayMode("fullscreen")).toThrow(ApiError));
});

describe("requirePrice", () => {
  it("rounds to cents", () => expect(requirePrice(4.999)).toBe(5.0));
  it("rejects negative", () => expect(() => requirePrice(-1)).toThrow(ApiError));
});

describe("requireSortOrder", () => {
  it("accepts 0", () => expect(requireSortOrder(0)).toBe(0));
  it("rejects negative", () => expect(() => requireSortOrder(-1)).toThrow(ApiError));
  it("rejects non-integer", () => expect(() => requireSortOrder(1.5)).toThrow(ApiError));
});

describe("requirePercent", () => {
  it("accepts boundary values 0 and 100", () => {
    expect(requirePercent(0, "x")).toBe(0);
    expect(requirePercent(100, "x")).toBe(100);
  });
  it("rejects out-of-range", () => {
    expect(() => requirePercent(-0.1, "x")).toThrow(ApiError);
    expect(() => requirePercent(100.1, "x")).toThrow(ApiError);
  });
});

describe("requireRotation", () => {
  it("accepts the four allowed rotations", () => {
    for (const r of [0, 90, 180, 270]) expect(requireRotation(r)).toBe(r);
  });
  it("rejects 45", () => expect(() => requireRotation(45)).toThrow(ApiError));
});

describe("requirePairingCode", () => {
  it("accepts a 6-digit string", () => expect(requirePairingCode("123456")).toBe("123456"));
  it("rejects 5 digits", () => expect(() => requirePairingCode("12345")).toThrow(ApiError));
  it("rejects non-numeric", () => expect(() => requirePairingCode("12345a")).toThrow(ApiError));
});

describe("requireCronOrOnce", () => {
  it("accepts a valid once schedule", () => {
    const result = requireCronOrOnce({ schedule_type: "once", run_once_at: "2026-08-01T12:00:00Z" });
    expect(result.schedule_type).toBe("once");
    expect(result.cron_expression).toBeNull();
  });
  it("accepts a valid cron schedule", () => {
    const result = requireCronOrOnce({ schedule_type: "cron", cron_expression: "0 9 * * *", timezone: "America/New_York" });
    expect(result.schedule_type).toBe("cron");
    expect(result.run_once_at).toBeNull();
  });
  it("rejects once without run_once_at", () => {
    expect(() => requireCronOrOnce({ schedule_type: "once" })).toThrow(ApiError);
  });
  it("rejects an unknown schedule_type", () => {
    expect(() => requireCronOrOnce({ schedule_type: "weekly" })).toThrow(ApiError);
  });
});

describe("parsePagination", () => {
  it("defaults to limit 50 offset 0", () => expect(parsePagination({})).toEqual({ limit: 50, offset: 0 }));
  it("clamps an oversized limit to 200", () => expect(parsePagination({ limit: 9999 }).limit).toBe(200));
  it("floors limit at 1", () => expect(parsePagination({ limit: 0 }).limit).toBe(1));
  it("ignores a negative offset", () => expect(parsePagination({ offset: -5 }).offset).toBe(0));
});
