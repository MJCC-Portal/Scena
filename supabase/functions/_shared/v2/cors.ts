// v2 CORS headers — extends _shared/http.ts's CORS_HEADERS with the v2
// request-id/idempotency-key headers so browser preflight allows them.

export const CORS_HEADERS_V2 = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-idempotency-key",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "x-request-id",
};
