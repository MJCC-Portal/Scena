// v2-facing error surface. Re-exports the single canonical ApiError/ErrorCode
// from src/shared/errors.ts (no second error system — see docs/API_V2.md
// architecture decision #3) and adds the envelope-aware parsing the v2
// client needs when a fetch response is an ErrorEnvelope.

import { ApiError, type ErrorCode } from "../../shared/errors";
import type { ErrorEnvelope } from "./envelopes";

export { ApiError, type ErrorCode };

/** A v2 network/transport failure that never reached a parseable envelope (malformed JSON, network error, non-JSON response). */
export class ApiV2TransportError extends Error {
  readonly requestId: string;
  readonly httpStatus: number;
  constructor(message: string, requestId: string, httpStatus: number) {
    super(message);
    this.requestId = requestId;
    this.httpStatus = httpStatus;
  }
}

export function apiErrorFromEnvelope(envelope: ErrorEnvelope, httpStatus: number): ApiError {
  const code = envelope.error.code as ErrorCode;
  return new ApiError(code, envelope.error.message, httpStatus, envelope.error.details);
}
