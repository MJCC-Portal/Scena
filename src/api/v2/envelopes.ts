// API v2 response envelope — every v2 endpoint (once they exist) returns
// one of these two shapes. See docs/API_V2.md for the full contract.

export const API_VERSION = "2" as const;

export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    api_version: typeof API_VERSION;
    request_id: string;
    [key: string]: unknown;
  };
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

export function successEnvelope<T>(data: T, requestId: string, extraMeta?: Record<string, unknown>): SuccessEnvelope<T> {
  return { data, meta: { api_version: API_VERSION, request_id: requestId, ...extraMeta } };
}

export function errorEnvelope(
  error: { code: string; message: string; details?: Record<string, unknown> },
  requestId: string,
): ErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      request_id: requestId,
    },
  };
}

export function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return typeof body === "object" && body !== null && "error" in body;
}

export function isSuccessEnvelope<T = unknown>(body: unknown): body is SuccessEnvelope<T> {
  return typeof body === "object" && body !== null && "data" in body && "meta" in body;
}
