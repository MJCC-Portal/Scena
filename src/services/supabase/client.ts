import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../shared/database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseUrl = url;
export const supabaseKey = key;

export const supabase: SupabaseClient<Database> | null = url && key
  ? createClient<Database>(url, key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error("Scena is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing.");
  return supabase;
}

/** Calls a Scena Edge Function with the current session's access token attached. */
export async function callEdgeFunction<TResponse = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token ?? supabaseKey!;
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: supabaseKey!,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = (payload as { error?: { code?: string; message?: string } }).error;
    throw new Error(err?.message ?? `${name} failed (${response.status})`);
  }
  return payload as TResponse;
}
