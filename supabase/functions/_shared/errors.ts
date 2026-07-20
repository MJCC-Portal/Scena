// Deno-side twin of src/shared/errors.ts — kept structurally identical so
// the Edge Functions and the browser client speak the exact same error
// contract. Duplicated (not imported) because Edge Functions run in Deno
// and the frontend is bundled by Vite; sharing a literal file across both
// runtimes would need a build step this project doesn't have.

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
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
  static membershipRequired(m = "Your account is not linked to an organization.") { return new ApiError("MEMBERSHIP_REQUIRED", m, 403); }
  static organizationSuspended(m = "This organization is suspended.") { return new ApiError("ORGANIZATION_SUSPENDED", m, 403); }
  static notFound(resource: string) { return new ApiError("RESOURCE_NOT_FOUND", `${resource} not found.`, 404); }
  static validation(m: string, details?: Record<string, unknown>) { return new ApiError("VALIDATION_FAILED", m, 400, details); }
  static crossOrg(m = "That resource does not belong to your organization.") { return new ApiError("CROSS_ORG_ACCESS", m, 403); }
  static internal(m = "Something went wrong.") { return new ApiError("INTERNAL_ERROR", m, 500); }
}
