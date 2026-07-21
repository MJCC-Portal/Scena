// Minimal, dependency-free runtime validation. TypeScript interfaces alone
// don't validate anything at the network boundary — every external input
// (form submit, RPC body, Edge Function payload) must run through here.

import { ApiError } from "./errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const ROLES = ["owner", "admin", "operator", "designer", "viewer"] as const;
const DISPLAY_MODES = ["independent", "duplicate", "extend", "single"] as const;
const ROTATIONS = [0, 90, 180, 270] as const;

export type Role = (typeof ROLES)[number];
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw ApiError.validation(`${field} must be a valid UUID.`, { field });
  return value;
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requireUuid(value, field);
}

export function requireString(value: unknown, field: string, opts: { min?: number; max?: number } = {}): string {
  const min = opts.min ?? 1;
  const max = opts.max ?? 255;
  if (typeof value !== "string") throw ApiError.validation(`${field} must be a string.`, { field });
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw ApiError.validation(`${field} must be between ${min} and ${max} characters.`, { field, min, max });
  }
  return trimmed;
}

export function requireSlug(value: unknown, field = "slug"): string {
  const slug = requireString(value, field, { min: 1, max: 63 });
  if (!SLUG_RE.test(slug)) throw ApiError.validation(`${field} must be lowercase alphanumeric with hyphens.`, { field });
  return slug;
}

export function requireRole(value: unknown, field = "role"): Role {
  if (typeof value !== "string" || !(ROLES as readonly string[]).includes(value)) {
    throw ApiError.validation(`${field} must be one of: ${ROLES.join(", ")}.`, { field, allowed: ROLES });
  }
  return value as Role;
}

export function requireDisplayMode(value: unknown, field = "display_mode"): DisplayMode {
  if (typeof value !== "string" || !(DISPLAY_MODES as readonly string[]).includes(value)) {
    throw ApiError.validation(`${field} must be one of: ${DISPLAY_MODES.join(", ")}.`, { field, allowed: DISPLAY_MODES });
  }
  return value as DisplayMode;
}

export function requirePrice(value: unknown, field = "price"): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw ApiError.validation(`${field} must be a non-negative number.`, { field });
  }
  return Math.round(value * 100) / 100;
}

export function requireSortOrder(value: unknown, field = "sort_order"): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw ApiError.validation(`${field} must be a non-negative integer.`, { field });
  }
  return value;
}

/** 0-100 inclusive percentage used by layout tiles and session-screen viewports. */
export function requirePercent(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw ApiError.validation(`${field} must be between 0 and 100.`, { field });
  }
  return value;
}

export function requireRotation(value: unknown, field = "rotation_degrees"): 0 | 90 | 180 | 270 {
  if (typeof value !== "number" || !(ROTATIONS as readonly number[]).includes(value)) {
    throw ApiError.validation(`${field} must be one of: ${ROTATIONS.join(", ")}.`, { field, allowed: ROTATIONS });
  }
  return value as 0 | 90 | 180 | 270;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw ApiError.validation(`${field} must be a boolean.`, { field });
  return value;
}

export function requirePairingCode(value: unknown, field = "code"): string {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw ApiError.validation(`${field} must be a 6-digit code.`, { field });
  }
  return value;
}

export function requireHex64(value: unknown, field: string): string {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if (!HEX64_RE.test(s)) throw ApiError.validation(`${field} must be a 64-character hex digest.`, { field });
  return s;
}

export function requireFilename(value: unknown, extensions: string[], field = "filename"): string {
  const name = requireString(value, field, { min: 1, max: 255 });
  const ok = extensions.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()));
  if (!ok) throw ApiError.validation(`${field} must end with one of: ${extensions.join(", ")}.`, { field, extensions });
  return name;
}

export function requireCronOrOnce(schedule: { schedule_type?: unknown; run_once_at?: unknown; cron_expression?: unknown; timezone?: unknown }) {
  const type = schedule.schedule_type;
  if (type !== "once" && type !== "cron") {
    throw ApiError.validation("schedule_type must be 'once' or 'cron'.", { field: "schedule_type" });
  }
  const timezone = requireString(schedule.timezone ?? "UTC", "timezone", { min: 1, max: 64 });
  if (type === "once") {
    const raw = schedule.run_once_at;
    if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
      throw ApiError.validation("run_once_at must be an ISO timestamp.", { field: "run_once_at" });
    }
    return { schedule_type: "once" as const, run_once_at: new Date(raw).toISOString(), cron_expression: null, timezone };
  }
  const cron = requireString(schedule.cron_expression, "cron_expression", { min: 1, max: 120 });
  return { schedule_type: "cron" as const, run_once_at: null, cron_expression: cron, timezone };
}

/** Pagination bounds shared by every list endpoint. */
export function parsePagination(input: { limit?: unknown; offset?: unknown }): { limit: number; offset: number } {
  const limit = typeof input.limit === "number" && Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 1), 200) : 50;
  const offset = typeof input.offset === "number" && Number.isInteger(input.offset) && input.offset >= 0 ? input.offset : 0;
  return { limit, offset };
}

export const ROLE_VALUES = ROLES;
export const DISPLAY_MODE_VALUES = DISPLAY_MODES;
