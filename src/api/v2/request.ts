// Request-ID generation and validation shared by the v2 client and (via
// its Deno twin, supabase/functions/_shared/v2/request.ts) every v2 Edge
// Function. A request ID is a correlation aid for logs/audit — it is
// never treated as authentication or authorization.

export const REQUEST_ID_HEADER = "x-request-id";
export const IDEMPOTENCY_KEY_HEADER = "x-idempotency-key";

const MAX_ID_LENGTH = 100;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Accepts a caller-supplied ID only if it's a safe, bounded token; otherwise generates a fresh one. */
export function resolveRequestId(candidate: string | null | undefined): string {
  if (candidate && candidate.length <= MAX_ID_LENGTH && SAFE_ID_PATTERN.test(candidate)) return candidate;
  return generateRequestId();
}

export function isValidRequestId(candidate: string): boolean {
  return candidate.length <= MAX_ID_LENGTH && SAFE_ID_PATTERN.test(candidate);
}
