// v2 envelope-aware response helpers — the Edge Function counterpart to
// src/api/v2/envelopes.ts. Every v2 route (scena-api/routes/v2/*, once
// they exist) should respond through these, not through _shared/http.ts's
// v1 `json`/`errorResponse` (which don't wrap in the v2 envelope).

import { ApiError } from "../errors.ts";
import { CORS_HEADERS_V2 } from "./cors.ts";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request.ts";

export function jsonV2(data: unknown, requestId: string, status = 200, extraMeta?: Record<string, unknown>): Response {
  const body = { data, meta: { api_version: "2", request_id: requestId, ...extraMeta } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId, ...CORS_HEADERS_V2 },
  });
}

export function errorResponseV2(err: unknown, requestId: string): Response {
  const apiError = err instanceof ApiError ? err : ApiError.internal();
  if (!(err instanceof ApiError)) console.error("unhandled v2 edge function error", err);
  const body = { error: { code: apiError.code, message: apiError.message, ...(apiError.details ? { details: apiError.details } : {}), request_id: requestId } };
  return new Response(JSON.stringify(body), {
    status: apiError.status,
    headers: { "content-type": "application/json", "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId, ...CORS_HEADERS_V2 },
  });
}

/** Standard v2 entrypoint wrapper: OPTIONS/method gating, request-ID resolution, error funneling. */
export function serveJsonV2(
  handler: (req: Request, requestId: string) => Promise<Response>,
  methods: string[] = ["POST"],
) {
  Deno.serve(async (req: Request) => {
    const requestId = resolveRequestId(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS_V2 });
    if (!methods.includes(req.method)) return errorResponseV2(ApiError.validation("method_not_allowed"), requestId);
    try {
      return await handler(req, requestId);
    } catch (err) {
      return errorResponseV2(err, requestId);
    }
  });
}
