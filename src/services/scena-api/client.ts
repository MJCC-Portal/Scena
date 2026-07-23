import { requireSupabase, supabaseKey, supabaseUrl } from "../supabase/client";
import { ScenaApiError } from "./errors";

export interface ScenaFunctionRequestOptions {
  signal?: AbortSignal;
  expectedStatuses?: readonly number[];
}

export async function callScenaFunction<TResponse>(
  functionName: string,
  body: Record<string, unknown>,
  options: ScenaFunctionRequestOptions = {},
): Promise<TResponse> {
  if (!supabaseUrl || !supabaseKey) {
    throw ScenaApiError.transport(
      "Scena is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing.",
    );
  }

  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw ScenaApiError.unauthenticated(error.message);
  }

  const token = data.session?.access_token;
  if (!token) {
    throw ScenaApiError.unauthenticated();
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        apikey: supabaseKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw ScenaApiError.transport("The Scena API is unavailable.");
  }

  const payload = await parseJson(response);
  const expected = options.expectedStatuses ?? [200, 201];

  if (!response.ok || !expected.includes(response.status)) {
    throw ScenaApiError.fromPayload(payload, response.status);
  }

  return payload as TResponse;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) {
      throw ScenaApiError.transport(
        "The Scena API returned a malformed response.",
        response.status,
      );
    }
    return {};
  }
}
