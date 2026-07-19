// Kiosk-side API client. Talks only to the display-gateway Edge Function
// with an opaque device token — no Supabase session, no keys.

import type { Scene } from "./scenes";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const TOKEN_KEY = "scena_display_token";

export type DisplayState =
  | { status: "pending" | "pair_expired" | "revoked" | "unknown_device" }
  | { status: "standby"; screen_name: string }
  | {
      status: "showing";
      screen_name: string;
      session_status: string | null;
      scene: Pick<Scene, "id" | "name" | "scene_type" | "config">;
      slideshow_url?: string;
      server_time: string;
    };

async function gateway<T>(payload: Record<string, unknown>): Promise<T> {
  if (!url) throw new Error("Display gateway is not configured");
  const response = await fetch(`${url}/functions/v1/display-gateway`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error || "Display gateway request failed");
  return body as T;
}

export function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function pairInit(): Promise<{ code: string; expires_in: number }> {
  const result = await gateway<{ token: string; code: string; expires_in: number }>({ action: "pair_init" });
  localStorage.setItem(TOKEN_KEY, result.token);
  return { code: result.code, expires_in: result.expires_in };
}

export async function pollState(): Promise<DisplayState> {
  const token = storedToken();
  if (!token) return { status: "unknown_device" };
  return gateway<DisplayState>({ action: "state", token });
}

export function forgetDevice(): void {
  localStorage.removeItem(TOKEN_KEY);
}
