// Deno twin of src/api/v2/request.ts — same request-ID policy, so a
// caller-supplied x-request-id is validated identically on both sides.

export const REQUEST_ID_HEADER = "x-request-id";
export const IDEMPOTENCY_KEY_HEADER = "x-idempotency-key";

const MAX_ID_LENGTH = 100;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function resolveRequestId(req: Request): string {
  const candidate = req.headers.get(REQUEST_ID_HEADER);
  if (candidate && candidate.length <= MAX_ID_LENGTH && SAFE_ID_PATTERN.test(candidate)) return candidate;
  return crypto.randomUUID();
}

export function readIdempotencyKey(req: Request): string | null {
  const key = req.headers.get(IDEMPOTENCY_KEY_HEADER);
  if (!key || key.length > MAX_ID_LENGTH || !SAFE_ID_PATTERN.test(key)) return null;
  return key;
}
