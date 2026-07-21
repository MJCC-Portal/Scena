// Shared MJCC handoff-consumption logic for the SSO callback path.
//
// KpnCompute currently redirects back to the bare app root with a
// `#code=...` fragment, not to /auth/callback — this function is called
// from both the root route (current real behavior) and /auth/callback
// (the route to prefer once KpnCompute is reconfigured to target it
// directly), so both paths share one implementation instead of drifting.
//
// The code is read and stripped from the URL by
// consumeSsoHandoffCode() (src/auth/sso.ts, unchanged) via
// history.replaceState before any network call — it is never logged and
// never written to storage.

import { consumeSsoHandoffCode, exchangeMjccCode } from "../auth/sso";

export type SsoExchangeResult =
  | { outcome: "no_code" }
  | { outcome: "success" }
  | { outcome: "error"; message: string };

export async function consumeAndExchangeSso(): Promise<SsoExchangeResult> {
  const code = consumeSsoHandoffCode();
  if (!code) return { outcome: "no_code" };
  try {
    await exchangeMjccCode(code);
    return { outcome: "success" };
  } catch (err) {
    return { outcome: "error", message: err instanceof Error ? err.message : "Sign-in failed." };
  }
}
