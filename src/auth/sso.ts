// MJCC SSO handoff exchange (browser side). Preserves the existing flow:
// KpnCompute issues a single-use code -> mjcc-sso-exchange Edge Function
// resolves/provisions the local Supabase Auth user via external_identities
// -> we adopt the returned session. Nothing here talks to another
// identity provider; this is the only sign-in path in the app.

import { requireSupabase, supabaseKey, supabaseUrl } from "../services/supabase/client";

export const mjccPortalUrl = (import.meta.env.VITE_MJCC_PORTAL_URL as string | undefined) ?? "https://mjcc.kpnsolute.com";

export interface MjccExchangeResult {
  id: string;
  mjcc_user_id: string;
  org_id: string;
  role: "owner" | "admin" | "operator";
  display_name?: string;
}

export function startMjccSignIn(): void {
  window.location.assign(`${mjccPortalUrl}/?launch=marquee`);
}

/** Reads and strips the one-time `#code=` fragment KpnCompute redirects back with. */
export function consumeSsoHandoffCode(): string | null {
  const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
  if (code) window.history.replaceState(null, "", window.location.pathname);
  return code;
}

export async function exchangeMjccCode(code: string): Promise<MjccExchangeResult> {
  const supabase = requireSupabase();
  const response = await fetch(`${supabaseUrl}/functions/v1/mjcc-sso-exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: supabaseKey!, authorization: `Bearer ${supabaseKey!}` },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "MJCC sign-in failed");
  const { error } = await supabase.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
  if (error) throw error;
  return payload.user as MjccExchangeResult;
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut();
}
