// API v2 browser client foundation. Calls a v2 endpoint, attaches the
// authenticated Supabase access token + a request ID (+ an idempotency
// key for mutations that ask for one), and parses the response into
// either typed data or a thrown ApiError/ApiV2TransportError.
//
// No product module is built on this yet (see docs/API_V2.md — Phase 2 is
// foundation only). src/api/v2/modules/ is where Team/Board/Display/etc.
// modules land in later phases, each calling requestV2() the same way.

import { requireSupabase, supabaseUrl, supabaseKey } from "../../services/supabase/client";
import { generateRequestId, REQUEST_ID_HEADER, IDEMPOTENCY_KEY_HEADER } from "./request";
import { isErrorEnvelope, isSuccessEnvelope, type SuccessEnvelope } from "./envelopes";
import { ApiError, ApiV2TransportError, apiErrorFromEnvelope } from "./errors";

export interface RequestV2Options {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  requestId?: string;
  idempotencyKey?: string;
  /** Set true for endpoints callable without a signed-in session (none exist yet). */
  allowAnonymous?: boolean;
}

/**
 * Calls `${SUPABASE_URL}/functions/v1/scena-api/v2/${path}` — the reserved
 * manager-JWT v2 router path (docs/API_V2.md architecture decision #1).
 * No such function is deployed yet; this will 404 until a later phase
 * deploys `supabase/functions/scena-api`. Callers get a clear
 * ApiV2TransportError in that case, not a silent empty success.
 */
export async function requestV2<T>(path: string, options: RequestV2Options = {}): Promise<SuccessEnvelope<T>> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Scena is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing.");

  const requestId = options.requestId ?? generateRequestId();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: supabaseKey,
    [REQUEST_ID_HEADER]: requestId,
  };
  if (options.idempotencyKey) headers[IDEMPOTENCY_KEY_HEADER] = options.idempotencyKey;

  if (!options.allowAnonymous) {
    const { data: sessionData } = await requireSupabase().auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw ApiError.unauthenticated();
    headers.authorization = `Bearer ${token}`;
  } else {
    headers.authorization = `Bearer ${supabaseKey}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/scena-api/v2/${path.replace(/^\/+/, "")}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new ApiV2TransportError("Received a non-JSON response from the server.", requestId, response.status);
  }

  if (isErrorEnvelope(parsed)) throw apiErrorFromEnvelope(parsed, response.status);
  if (isSuccessEnvelope<T>(parsed)) return parsed;
  throw new ApiV2TransportError("Received a malformed response envelope from the server.", requestId, response.status);
}
