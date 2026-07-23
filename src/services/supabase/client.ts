import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScenaDatabase } from "../../shared/scena-database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseUrl = url;
export const supabaseKey = key;

export const supabase: SupabaseClient<ScenaDatabase> | null = url && key
  ? createClient<ScenaDatabase>(url, key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient<ScenaDatabase> {
  if (!supabase) {
    throw new Error(
      "Scena is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing.",
    );
  }
  return supabase;
}

/**
 * Legacy authenticated Edge Function helper.
 *
 * New Asset, Board, and Workspace UI code must use src/services/scena-api so
 * stable error codes, request IDs, and details are preserved. This helper
 * remains for existing domain modules and no longer falls back to the public
 * publishable key when the session is missing.
 */
export async function callEdgeFunction<TResponse = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();

  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Sign in is required.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: supabaseKey!,
      authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = (
      payload as {
        error?: {
          code?: string;
          message?: string;
          request_id?: string;
          details?: Record<string, unknown>;
        };
      }
    ).error;

    const failure = new Error(
      error?.message ?? `${name} failed (${response.status})`,
    ) as Error & {
      code?: string;
      status?: number;
      requestId?: string;
      details?: Record<string, unknown>;
    };

    failure.code = error?.code;
    failure.status = response.status;
    failure.requestId = error?.request_id;
    failure.details = error?.details;
    throw failure;
  }

  return payload as TResponse;
}
