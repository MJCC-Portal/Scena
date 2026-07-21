// Kiosk-side API client. Talks only to screen-register (once, before a
// device credential exists) and display-gateway (every poll after) with
// an opaque device token — no Supabase session, no keys.
//
// Offline behavior lives here too: every successful "showing" response is
// cached to localStorage; on any fetch failure the last cached payload is
// served back so the kiosk keeps displaying instead of erroring out, and
// a full authoritative refresh replaces it atomically the moment the
// network recovers (see resolveDisplayState's content_version — the
// caller only needs to swap state wholesale, never patch it).

import type { ResolvedDisplayState } from "../display/resolveDisplayState";
import { supabase } from "../services/supabase/client";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const TOKEN_KEY = "scena_display_token";
const CACHE_KEY = "scena_display_cache";

// org_id rides along on every "pending"/"standby"/"showing" response (see
// display-gateway/index.ts) so the kiosk knows which invalidation
// broadcast channel to join — it's never used to trust org-scoped data,
// only to pick a channel name.
export type DisplayState =
  | { status: "pending" | "unknown_device" | "revoked" }
  | (ResolvedDisplayState & { org_id: string | null });

async function gateway<T>(fn: string, payload: Record<string, unknown>): Promise<T> {
  if (!url) throw new Error("Display gateway is not configured");
  const response = await fetch(`${url}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error?.message || body?.error || `${fn} request failed`);
  return body as T;
}

export function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function forgetDevice(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CACHE_KEY);
}

export async function registerDevice(): Promise<{ code: string; expires_in: number }> {
  const result = await gateway<{ screen_id: string; device_token: string; code: string; expires_in: number }>("screen-register", {});
  localStorage.setItem(TOKEN_KEY, result.device_token);
  return { code: result.code, expires_in: result.expires_in };
}

function readCache(): DisplayState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DisplayState) : null;
  } catch {
    return null;
  }
}

/** Read-only accessor for the kiosk route's error boundary — lets a
 * caught render exception attempt to restore the last known-good display
 * instead of leaving the screen permanently blank. Added for routing
 * (src/display/DisplayErrorBoundary.tsx); the caching behavior itself is
 * unchanged. */
export function readCachedDisplayState(): DisplayState | null {
  return readCache();
}

function writeCache(state: DisplayState) {
  if (state.status === "showing") localStorage.setItem(CACHE_KEY, JSON.stringify(state));
}

/**
 * Fetches the authoritative state. On network failure, falls back to the
 * last cached "showing" payload rather than surfacing an error state, so
 * a kiosk that briefly loses connectivity keeps rendering what it already
 * had — never a blank screen or a browser error page.
 */
export async function pollState(): Promise<{ state: DisplayState; fromCache: boolean }> {
  const token = storedToken();
  if (!token) return { state: { status: "unknown_device" }, fromCache: false };
  try {
    const state = await gateway<DisplayState>("display-gateway", { device_token: token });
    if (state.status === "unknown_device" || state.status === "revoked") forgetDevice();
    else writeCache(state);
    return { state, fromCache: false };
  } catch (err) {
    const cached = readCache();
    if (cached) return { state: cached, fromCache: true };
    throw err;
  }
}

/**
 * Joins the org-scoped invalidation broadcast channel (Realtime
 * Broadcast, not `postgres_changes` — this connection has no Supabase
 * session, so it holds no RLS grant to receive table-change events at
 * all; broadcast is plain pub/sub and works regardless). `onHint` should
 * trigger an immediate `pollState()` — the broadcast payload itself is
 * untrusted and carries no data, only a "something changed" nudge.
 * Reconnect (Supabase's client auto-reconnects the socket) re-fires
 * `subscribe`'s callback, so the caller should treat every `SUBSCRIBED`
 * status the same as a hint and poll once immediately.
 */
export function subscribeToOrgInvalidation(orgId: string, onHint: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel(`org:${orgId}`, { config: { broadcast: { self: false, ack: false } } })
    .on("broadcast", { event: "invalidate" }, () => onHint())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onHint();
    });
  return () => { client.removeChannel(channel); };
}
