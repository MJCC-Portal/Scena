import { useEffect, useState } from "react";
import { exchangeMjccCode, supabase } from "./lib/supabase";

const mjccPortal = (import.meta.env.VITE_MJCC_PORTAL_URL as string | undefined) ?? "https://mjcc-managements.onrender.com";

export function App() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    if (code) {
      window.history.replaceState(null, "", window.location.pathname);
      exchangeMjccCode(code)
        .then((next) => { if (active) setUser(next); })
        .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Sign-in failed"); })
        .finally(() => { if (active) setBusy(false); });
      return () => { active = false; };
    }
    supabase?.auth.getUser().then(({ data }) => { if (active) setUser(data.user ? { id: data.user.id } : null); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  if (busy) return <main className="shell"><div className="card">Checking your MJCC session…</div></main>;
  if (!user) return <main className="shell"><section className="card auth-card">
    <div className="mark">M</div><p className="eyebrow">MJCC OPERATIONS</p><h1>Sign in to Marquee</h1>
    <p className="muted">Use your central MJCC account to manage display sessions and kiosk streams.</p>
    {error && <div className="error">{error}</div>}
    <button className="primary" onClick={() => window.location.assign(`${mjccPortal}/?launch=marquee`)}>Continue with MJCC <span>→</span></button>
    <p className="fine">Managers sign in once through KpnCompute. Marquee never stores a separate manager password.</p>
  </section></main>;
  return <main className="shell"><section className="card"><p className="eyebrow">MJCC · MARQUEE</p><h1>Manager portal</h1><p className="muted">Your MJCC identity is connected. Session controls will appear here next.</p><button className="secondary" onClick={() => supabase?.auth.signOut().then(() => setUser(null))}>Sign out</button></section></main>;
}
