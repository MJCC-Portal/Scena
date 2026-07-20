import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requiredEnv } from "./http.ts";

/** Service-role client. Every Edge Function in this project uses this —
 * never the anon/publishable key — because they perform the privileged,
 * multi-step operations (pairing, credentials, session activation,
 * presentation callbacks, automation execution) that RLS intentionally
 * does not grant to authenticated or anon roles. */
export function adminClient(): SupabaseClient {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
