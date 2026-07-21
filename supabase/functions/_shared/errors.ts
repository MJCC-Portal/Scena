// Deno-side twin of src/shared/errors.ts — kept structurally identical so
// the Edge Functions and the browser client speak the exact same error
// contract. Duplicated (not imported) because Edge Functions run in Deno
// and the frontend is bundled by Vite; sharing a literal file across both
// runtimes would need a build step this project doesn't have.

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
  // API v2 stable codes (docs/API_V2.md). Additive only.
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
  toBody() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
  static unauthenticated(m = "Sign-in required.") { return new ApiError("UNAUTHENTICATED", m, 401); }
  static forbidden(m = "Not allowed.") { return new ApiError("FORBIDDEN", m, 403); }
  static accountProfileRequired(m = "Your account profile is still being set up.") { return new ApiError("ACCOUNT_PROFILE_REQUIRED", m, 409); }
  static membershipRequired(m = "Your account is not linked to an organization.") { return new ApiError("MEMBERSHIP_REQUIRED", m, 403); }
  static organizationSuspended(m = "This organization is suspended.") { return new ApiError("ORGANIZATION_SUSPENDED", m, 403); }
  static notFound(resource: string) { return new ApiError("RESOURCE_NOT_FOUND", `${resource} not found.`, 404); }
  static validation(m: string, details?: Record<string, unknown>) { return new ApiError("VALIDATION_FAILED", m, 400, details); }
  static crossOrg(m = "That resource does not belong to your organization.") { return new ApiError("CROSS_ORG_ACCESS", m, 403); }
  static internal(m = "Something went wrong.") { return new ApiError("INTERNAL_ERROR", m, 500); }

  // API v2 stable-code constructors (docs/API_V2.md).
  static teamRequired(m = "This action requires an active Team.") { return new ApiError("TEAM_REQUIRED", m, 403); }
  static teamLimitReached(m = "This account already belongs to an active Team.") { return new ApiError("TEAM_LIMIT_REACHED", m, 409); }
  static teamOverLimit(m = "This Team is over its plan limit.", details?: Record<string, unknown>) { return new ApiError("TEAM_OVER_LIMIT", m, 403, details); }
  static planRequired(m = "Choose a plan to continue.") { return new ApiError("PLAN_REQUIRED", m, 402); }
  static planFeatureRequired(m = "This feature is not included in the current plan.") { return new ApiError("PLAN_FEATURE_REQUIRED", m, 402); }
  static subscriptionRequired(m = "An active subscription is required.") { return new ApiError("SUBSCRIPTION_REQUIRED", m, 402); }
  static subscriptionInactive(m = "This Team's subscription is not active.") { return new ApiError("SUBSCRIPTION_INACTIVE", m, 402); }
  static memberLimitReached(m = "This Team has reached its member limit.") { return new ApiError("MEMBER_LIMIT_REACHED", m, 409); }
  static boardLimitReached(m = "This Team has reached its Board limit.") { return new ApiError("BOARD_LIMIT_REACHED", m, 409); }
  static displayLimitReached(m = "This Team has reached its Display limit.") { return new ApiError("DISPLAY_LIMIT_REACHED", m, 409); }
  static sessionLimitReached(m = "This Team has reached its concurrent Session limit.") { return new ApiError("SESSION_LIMIT_REACHED", m, 409); }
  static sessionDisplayLimitReached(m = "A Session allows at most 4 Displays.") { return new ApiError("SESSION_DISPLAY_LIMIT_REACHED", m, 409); }
  static resourceConflict(m = "This request conflicts with the resource's current state.", details?: Record<string, unknown>) { return new ApiError("RESOURCE_CONFLICT", m, 409, details); }
  static invalidInvitation(m = "This invitation is invalid or has expired.") { return new ApiError("INVALID_INVITATION", m, 400); }
  static invitationEmailMismatch(m = "This invitation was issued to a different email address.") { return new ApiError("INVITATION_EMAIL_MISMATCH", m, 403); }
  static displayCredentialInvalid(m = "Invalid Display credential.") { return new ApiError("DISPLAY_CREDENTIAL_INVALID", m, 401); }
  static displayRevoked(m = "This Display's credential has been revoked.") { return new ApiError("DISPLAY_REVOKED", m, 403); }
  static processingFailed(m = "Processing failed.", details?: Record<string, unknown>) { return new ApiError("PROCESSING_FAILED", m, 422, details); }
  static notFoundV2(resource: string) { return new ApiError("NOT_FOUND", `${resource} not found.`, 404); }
  static idempotencyConflict(m = "This request was already processed with a different payload.") { return new ApiError("IDEMPOTENCY_CONFLICT", m, 409); }
}
