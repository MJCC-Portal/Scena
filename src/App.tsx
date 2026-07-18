import { useEffect, useState } from "react";
import { exchangeMjccCode, loadManagerContext, supabase, type ManagerContext } from "./lib/supabase";

const mjccPortal = (import.meta.env.VITE_MJCC_PORTAL_URL as string | undefined) ?? "https://mjcc-managements.onrender.com";

type View = "overview" | "scenes" | "sessions" | "displays";

const roleLabels: Record<ManagerContext["membership"]["role"], string> = {
  owner: "Owner", admin: "Administrator", operator: "Operator", viewer: "Viewer",
};

export function App() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [context, setContext] = useState<ManagerContext | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const finish = (next: Record<string, unknown> | null) => {
      if (!active) return;
      setUser(next);
      if (!next) setBusy(false);
    };
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    if (code) {
      window.history.replaceState(null, "", window.location.pathname);
      exchangeMjccCode(code)
        .then((next) => finish(next))
        .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Sign-in failed"); })
        .finally(() => { if (active) setBusy(false); });
    } else {
      supabase?.auth.getUser()
        .then(({ data }) => finish(data.user ? { id: data.user.id, email: data.user.email } : null))
        .catch(() => finish(null));
      if (!supabase) setBusy(false);
    }
    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUser(null); setContext(null); }
    });
    return () => { active = false; listener?.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadManagerContext()
      .then((next) => { if (active) setContext(next); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Could not load organization access"); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [user]);

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null); setContext(null); setError("");
  }

  if (busy) return <main className="shell"><div className="card loading-card"><div className="mark">M</div><p>Loading your MJCC workspace…</p></div></main>;
  if (!user || !context) return <main className="shell"><section className="card auth-card">
    <div className="mark">M</div><p className="eyebrow">MJCC OPERATIONS</p><h1>{user ? "Access unavailable" : "Sign in to Marquee"}</h1>
    <p className="muted">{error || "Use your central MJCC account to manage display sessions and kiosk streams."}</p>
    {error && <div className="error">{error}</div>}
    <button className="primary" onClick={() => window.location.assign(`${mjccPortal}/?launch=marquee`)}>Continue with MJCC <span>→</span></button>
    <p className="fine">Managers sign in once through KpnCompute. Marquee never stores a separate manager password.</p>
  </section></main>;

  const canManage = context.membership.role !== "viewer";
  const nav: Array<{ id: View; label: string; icon: string; managerOnly?: boolean }> = [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "scenes", label: "Scenes", icon: "✦", managerOnly: true },
    { id: "sessions", label: "Sessions", icon: "▶", managerOnly: true },
    { id: "displays", label: "Displays", icon: "▣" },
  ];
  return <main className="portal-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="mini-mark">M</div><span>Marquee</span></div>
      <div className="org-switcher"><span className="org-dot" />{context.organization.name}<small>{roleLabels[context.membership.role]}</small></div>
      <nav>{nav.filter((item) => !item.managerOnly || canManage).map((item) => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="sidebar-foot"><button className="nav-item" onClick={signOut}><span>↪</span>Sign out</button><small>MJCC · Marquee</small></div>
    </aside>
    <section className="portal-main">
      <header className="topbar"><div><p className="eyebrow">MANAGER PORTAL</p><h2>{nav.find((item) => item.id === view)?.label}</h2></div><div className="profile-chip"><span className="avatar">{String(user.email ?? "M").slice(0, 1).toUpperCase()}</span><span>{String(user.email ?? "MJCC manager")}</span></div></header>
      {view === "overview" && <Overview context={context} canManage={canManage} onNavigate={setView} />}
      {view === "scenes" && <EmptyState title="Scenes" description="Scene creation and layout editing will be the next vertical slice." action="Create scene" disabled={!canManage} />}
      {view === "sessions" && <EmptyState title="Sessions" description="Session start/stop controls will connect to the live API next." action="Start session" disabled={!canManage} />}
      {view === "displays" && <EmptyState title="Displays" description="Connected kiosk monitoring will appear after session control is active." action="Connect display" disabled />}
    </section>
  </main>;
}

function Overview({ context, canManage, onNavigate }: { context: ManagerContext; canManage: boolean; onNavigate: (view: View) => void }) {
  return <div className="content"><div className="welcome"><div><p className="eyebrow">{context.organization.slug.toUpperCase()} WORKSPACE</p><h1>Ready when you are.</h1><p className="muted">Create a scene, start a session, and send the display to your kiosks.</p></div><div className="welcome-orb">✦</div></div><div className="stat-grid"><Stat label="Active session" value="None" note="No display is running" /><Stat label="Scenes" value="0" note="Create your first scene" /><Stat label="Displays" value="0" note="No kiosks connected" /></div><div className="next-card"><div><p className="eyebrow">NEXT STEP</p><h3>Build your first display scene</h3><p className="muted">Scenes are the content your kiosks will render during an active session.</p></div><button className="primary compact" disabled={!canManage} onClick={() => onNavigate("scenes")}>Open scenes <span>→</span></button></div></div>;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) { return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function EmptyState({ title, description, action, disabled }: { title: string; description: string; action: string; disabled: boolean }) { return <div className="content"><div className="empty-card"><div className="empty-icon">✦</div><h3>{title} is coming next</h3><p className="muted">{description}</p><button className="primary compact" disabled={disabled}>{action}</button></div></div>; }
