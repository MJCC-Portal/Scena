import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key) : null;

export async function exchangeMjccCode(code: string) {
  if (!supabase) throw new Error("Marquee authentication is not configured");
  const response = await fetch(`${url}/functions/v1/mjcc-sso-exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key!, Authorization: `Bearer ${key!}` },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "MJCC sign-in failed");
  await supabase.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
  return payload.user;
}
