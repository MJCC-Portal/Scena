export interface ScenaApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
    request_id?: unknown;
    details?: unknown;
  };
  request_id?: unknown;
}

export class ScenaApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    requestId: string | null = null,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ScenaApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }

  static unauthenticated(message = "Sign in is required."): ScenaApiError {
    return new ScenaApiError("UNAUTHENTICATED", message, 401);
  }

  static transport(message: string, status = 0): ScenaApiError {
    return new ScenaApiError("API_UNAVAILABLE", message, status);
  }

  static fromPayload(payload: unknown, status: number): ScenaApiError {
    const body = isRecord(payload) ? payload as ScenaApiErrorPayload : {};
    const error = isRecord(body.error) ? body.error : {};
    const code = typeof error.code === "string" && error.code
      ? error.code
      : `HTTP_${status}`;
    const message = typeof error.message === "string" && error.message
      ? error.message
      : `The Scena API request failed with HTTP ${status}.`;
    const requestId = typeof error.request_id === "string"
      ? error.request_id
      : typeof body.request_id === "string"
        ? body.request_id
        : null;
    const details = isRecord(error.details) ? error.details : undefined;
    return new ScenaApiError(code, message, status, requestId, details);
  }
}

export function isScenaApiError(error: unknown): error is ScenaApiError {
  return error instanceof ScenaApiError;
}

export function isBoardVersionConflict(error: unknown): error is ScenaApiError {
  return error instanceof ScenaApiError && error.code === "BOARD_VERSION_CONFLICT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
