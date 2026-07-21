// Minimal v2-specific validators. Ordinary field validation for a given
// resource belongs in that resource's own module once it exists — this
// file only covers the request-shaped concerns every v2 route needs
// (pagination, etc.), mirroring src/shared/validation.ts's style.

import { ApiError } from "../errors.ts";

export function parsePagination(input: { limit?: unknown; offset?: unknown }): { limit: number; offset: number } {
  const limit = typeof input.limit === "number" && Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 1), 200) : 50;
  const offset = typeof input.offset === "number" && Number.isInteger(input.offset) && input.offset >= 0 ? input.offset : 0;
  return { limit, offset };
}

export async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("not an object");
    return body as Record<string, unknown>;
  } catch {
    throw ApiError.validation("Request body must be a JSON object.");
  }
}
