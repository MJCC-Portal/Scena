import { ApiError } from "./errors.ts";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-scena-callback-secret",
  "access-control-allow-methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS_HEADERS },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) return json(err.toBody(), err.status);
  console.error("unhandled edge function error", err);
  return json(ApiError.internal().toBody(), 500);
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing required env var: ${name}`);
  return value;
}

/** Standard entrypoint wrapper: handles OPTIONS/method gating and funnels
 * every thrown error (ApiError or otherwise) through the stable contract. */
export function serveJson(handler: (req: Request) => Promise<Response>, methods: string[] = ["POST"]) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (!methods.includes(req.method)) return json(ApiError.validation("method_not_allowed").toBody(), 405);
    try {
      return await handler(req);
    } catch (err) {
      return errorResponse(err);
    }
  });
}
