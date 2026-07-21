// Stable API error contract shared by every service/domain module and by
// the Edge Functions (see supabase/functions/_shared/errors.ts for the
// Deno-side twin — kept structurally identical on purpose).

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ACCOUNT_PROFILE_REQUIRED",
  "MEMBERSHIP_REQUIRED",
  "ORGANIZATION_SUSPENDED",
  "RESOURCE_NOT_FOUND",
  "VALIDATION_FAILED",
  "PAIRING_CODE_INVALID",
  "PAIRING_CODE_EXPIRED",
  "PAIRING_CODE_CONSUMED",
  "PAIRING_CODE_LOCKED",
  "SCREEN_DISABLED",
  "SCREEN_REVOKED",
  "DEVICE_CREDENTIAL_INVALID",
  "SCREEN_LIMIT_REACHED",
  "SCREEN_ALREADY_ACTIVE",
  "SESSION_NOT_DRAFT",
  "SESSION_NOT_ACTIVE",
  "LAYOUT_INVALID",
  "PRESENTATION_NOT_READY",
  "AUTOMATION_EXECUTION_FAILED",
  "CROSS_ORG_ACCESS",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }

  static unauthenticated(message = "Sign-in required.") {
    return new ApiError("UNAUTHENTICATED", message, 401);
  }
  static forbidden(message = "Not allowed.") {
    return new ApiError("FORBIDDEN", message, 403);
  }
  static accountProfileRequired(message = "Your account profile is still being set up.") {
    return new ApiError("ACCOUNT_PROFILE_REQUIRED", message, 409);
  }
  static membershipRequired(message = "Your account is not linked to an organization.") {
    return new ApiError("MEMBERSHIP_REQUIRED", message, 403);
  }
  static organizationSuspended(message = "This organization is suspended.") {
    return new ApiError("ORGANIZATION_SUSPENDED", message, 403);
  }
  static notFound(resource: string) {
    return new ApiError("RESOURCE_NOT_FOUND", `${resource} not found.`, 404);
  }
  static validation(message: string, details?: Record<string, unknown>) {
    return new ApiError("VALIDATION_FAILED", message, 400, details);
  }
  static crossOrg(message = "That resource does not belong to your organization.") {
    return new ApiError("CROSS_ORG_ACCESS", message, 403);
  }
  static internal(message = "Something went wrong.") {
    return new ApiError("INTERNAL_ERROR", message, 500);
  }
}

/**
 * Postgres constraint/check-violation names carry business meaning in this
 * schema (see docs/DATABASE_SCHEMA.md). Translate the ones a client can hit
 * into the stable error contract instead of leaking raw Postgres text.
 */
export function mapPostgresError(err: unknown): ApiError {
  // PostgREST/Supabase errors are plain objects ({message, code, details,
  // hint}), not real Error instances — check for a .message property
  // before falling back to Error/String, or every plain-object error
  // (the common case from `.from(...).insert(...)` etc.) silently loses
  // its text and falls through to the generic 23505/23514 default.
  const message = typeof (err as { message?: unknown })?.message === "string"
    ? (err as { message: string }).message
    : err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code;

  if (code === "23505") { // unique_violation
    if (/pair_code|screen_pairing_codes/.test(message)) return new ApiError("PAIRING_CODE_INVALID", "That pairing code is already in use.", 409);
    if (/one_live_session_per_screen/.test(message)) return new ApiError("SCREEN_ALREADY_ACTIVE", "That screen is already live in another session.", 409);
    if (/one_primary_screen_per_session/.test(message)) return ApiError.validation("Only one screen can be primary per session.");
    if (/device_token_hash/.test(message)) return new ApiError("DEVICE_CREDENTIAL_INVALID", "Credential collision — retry.", 409);
    return ApiError.validation("That value is already in use.");
  }
  if (code === "23514") { // check_violation
    if (/screens_check/.test(message)) return new ApiError("SCREEN_DISABLED", "That screen is not in a valid state for this action.", 409);
    if (/display_sessions_check/.test(message) || /display_session_screens_check/.test(message)) {
      return new ApiError("LAYOUT_INVALID", "This display configuration is invalid for the selected mode.", 400);
    }
    if (/presentation_assets_check/.test(message)) return new ApiError("PRESENTATION_NOT_READY", "This presentation is not ready yet.", 409);
    return ApiError.validation("That change violates a data rule: " + message);
  }
  if (code === "23503") return ApiError.notFound("Referenced resource"); // foreign_key_violation
  if (/screen entitlement/i.test(message) || /screen\(s\) per session/i.test(message)) {
    return new ApiError("SCREEN_LIMIT_REACHED", message, 409);
  }
  if (/stopped session/i.test(message)) return new ApiError("SESSION_NOT_DRAFT", message, 409);
  if (/ready screens/i.test(message)) return new ApiError("SCREEN_DISABLED", message, 409);
  if (/enabled screen to have its own layout|enabled screen to have a layout/i.test(message)) {
    return new ApiError("LAYOUT_INVALID", message, 400);
  }
  if (/exactly one enabled screen/i.test(message)) return new ApiError("LAYOUT_INVALID", message, 400);
  if (/must be created as a draft/i.test(message)) return new ApiError("SESSION_NOT_DRAFT", message, 409);

  return ApiError.internal(message);
}
