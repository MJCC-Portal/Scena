// Stable API error contract shared by every service/domain module and by
// the Edge Functions (see supabase/functions/_shared/errors.ts for the
// Deno-side twin — kept structurally identical on purpose).

export const ERROR_CODES = [
  // Shared v1 + v2 codes.
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
  // API v2 stable codes (docs/API_V2.md). Additive only — no v1 code above
  // is renamed or removed, even where a v2 code covers similar ground
  // under new Team/Board/Display/Session terminology (e.g. NOT_FOUND vs.
  // RESOURCE_NOT_FOUND, DISPLAY_CREDENTIAL_INVALID vs. DEVICE_CREDENTIAL_INVALID)
  // — see the legacy/v2 error-code mapping table in that doc.
  "TEAM_REQUIRED",
  "TEAM_LIMIT_REACHED",
  "TEAM_OVER_LIMIT",
  "PLAN_REQUIRED",
  "PLAN_FEATURE_REQUIRED",
  "SUBSCRIPTION_REQUIRED",
  "SUBSCRIPTION_INACTIVE",
  "MEMBER_LIMIT_REACHED",
  "BOARD_LIMIT_REACHED",
  "DISPLAY_LIMIT_REACHED",
  "SESSION_LIMIT_REACHED",
  "SESSION_DISPLAY_LIMIT_REACHED",
  "RESOURCE_CONFLICT",
  "INVALID_INVITATION",
  "INVITATION_EMAIL_MISMATCH",
  "DISPLAY_CREDENTIAL_INVALID",
  "DISPLAY_REVOKED",
  "PROCESSING_FAILED",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
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

  // API v2 stable-code constructors (docs/API_V2.md).
  static teamRequired(message = "This action requires an active Team.") {
    return new ApiError("TEAM_REQUIRED", message, 403);
  }
  static teamLimitReached(message = "This account already belongs to an active Team.") {
    return new ApiError("TEAM_LIMIT_REACHED", message, 409);
  }
  static teamOverLimit(message = "This Team is over its plan limit.", details?: Record<string, unknown>) {
    return new ApiError("TEAM_OVER_LIMIT", message, 403, details);
  }
  static planRequired(message = "Choose a plan to continue.") {
    return new ApiError("PLAN_REQUIRED", message, 402);
  }
  static planFeatureRequired(message = "This feature is not included in the current plan.") {
    return new ApiError("PLAN_FEATURE_REQUIRED", message, 402);
  }
  static subscriptionRequired(message = "An active subscription is required.") {
    return new ApiError("SUBSCRIPTION_REQUIRED", message, 402);
  }
  static subscriptionInactive(message = "This Team's subscription is not active.") {
    return new ApiError("SUBSCRIPTION_INACTIVE", message, 402);
  }
  static memberLimitReached(message = "This Team has reached its member limit.") {
    return new ApiError("MEMBER_LIMIT_REACHED", message, 409);
  }
  static boardLimitReached(message = "This Team has reached its Board limit.") {
    return new ApiError("BOARD_LIMIT_REACHED", message, 409);
  }
  static displayLimitReached(message = "This Team has reached its Display limit.") {
    return new ApiError("DISPLAY_LIMIT_REACHED", message, 409);
  }
  static sessionLimitReached(message = "This Team has reached its concurrent Session limit.") {
    return new ApiError("SESSION_LIMIT_REACHED", message, 409);
  }
  static sessionDisplayLimitReached(message = "A Session allows at most 4 Displays.") {
    return new ApiError("SESSION_DISPLAY_LIMIT_REACHED", message, 409);
  }
  static resourceConflict(message = "This request conflicts with the resource's current state.", details?: Record<string, unknown>) {
    return new ApiError("RESOURCE_CONFLICT", message, 409, details);
  }
  static invalidInvitation(message = "This invitation is invalid or has expired.") {
    return new ApiError("INVALID_INVITATION", message, 400);
  }
  static invitationEmailMismatch(message = "This invitation was issued to a different email address.") {
    return new ApiError("INVITATION_EMAIL_MISMATCH", message, 403);
  }
  static displayCredentialInvalid(message = "Invalid Display credential.") {
    return new ApiError("DISPLAY_CREDENTIAL_INVALID", message, 401);
  }
  static displayRevoked(message = "This Display's credential has been revoked.") {
    return new ApiError("DISPLAY_REVOKED", message, 403);
  }
  static processingFailed(message = "Processing failed.", details?: Record<string, unknown>) {
    return new ApiError("PROCESSING_FAILED", message, 422, details);
  }
  /** v2 canonical NOT_FOUND — use this in new v2 code; `notFound()` (RESOURCE_NOT_FOUND) stays for v1 compatibility. */
  static notFoundV2(resource: string) {
    return new ApiError("NOT_FOUND", `${resource} not found.`, 404);
  }
  static idempotencyConflict(message = "This request was already processed with a different payload.") {
    return new ApiError("IDEMPOTENCY_CONFLICT", message, 409);
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
