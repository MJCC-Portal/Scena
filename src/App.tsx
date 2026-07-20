// Scena manager portal — minimal functional test harness.
//
// This rebuild's scope is the backend service layer and API surface, not
// UI polish (see docs/BUILD_PLAN.md). This shell exists to: preserve MJCC
// authentication end to end, load organization context, and exercise
// every domain module through raw forms + JSON output so the wiring can
// be verified in a real browser. A real UI can be built on top of the
// same domain/* functions later without touching this logic.

import { useEffect, useState } from "react";
import { consumeSsoHandoffCode, exchangeMjccCode, mjccPortalUrl, signOut, startMjccSignIn } from "./auth/sso";
import { canManage, loadManagerContext, type ManagerContext } from "./auth/organization-context";
import { supabase } from "./services/supabase/client";
import { callEdgeFunction } from "./services/supabase/client";
import * as Locations from "./domain/locations";
import * as Menus from "./domain/menus";
import * as Scenes from "./domain/scenes";
import * as Layouts from "./domain/layouts";
import * as Screens from "./domain/screens";
import * as Sessions from "./domain/sessions";
import * as Automations from "./domain/automations";
import * as Orgs from "./domain/organizations";

export function App() {
  const [context, setContext] = useState<ManagerContext | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const code = consumeSsoHandoffCode();
    (code ? exchangeMjccCode(code) : Promise.resolve(null))
      .then(() => loadManagerContext())
      .then((ctx) => { if (active) setContext(ctx); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Sign-in failed"); })
      .finally(() => { if (active) setBusy(false); });
    const listener = supabase?.auth.onAuthStateChange((_event, session) => { if (!session) setContext(null); });
    return () => { active = false; listener?.data.subscription.unsubscribe(); };
  }, []);

  if (busy) return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Loading your MJCC workspace…</p></div></main>;

  if (!context) return <main className="auth-shell"><section className="auth-card">
    <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
    <h1>{error ? "Access unavailable" : "Sign in to Scena"}</h1>
    <p className="muted">{error || "Use your central MJCC account to run boards, queues, and kiosk screens."}</p>
    {error && <div className="error">{error}</div>}
    <button className="btn gold" onClick={startMjccSignIn}>Continue with MJCC</button>
    <p className="fine">Managers sign in once through KpnCompute ({mjccPortalUrl}). Scena never stores a separate manager password.</p>
  </section></main>;

  return <Harness context={context} onSignOut={() => signOut().then(() => setContext(null))} />;
}

function Harness({ context, onSignOut }: { context: ManagerContext; onSignOut: () => void }) {
  const manage = canManage(context.role);
  const [tab, setTab] = useState<Tab>("locations");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<Locations.Location[]>([]);

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  return <div className="shell" style={{ display: "block", padding: 16, fontFamily: "system-ui, sans-serif" }}>
    <header className="topbar" style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
      <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
      <div>Tenant <b>{context.organization.name}</b> · {context.role}</div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <span style={{ flex: 1 }} />
      <button className="btn" onClick={onSignOut}>Sign out</button>
    </header>
    <nav style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {TABS.map((t) => <button key={t} className={t === tab ? "nav-btn active" : "nav-btn"} onClick={() => setTab(t)}>{t}</button>)}
    </nav>
    {tab === "locations" && <LocationsPanel orgId={context.organization.id} manage={manage} locations={locations} onChanged={setLocations} />}
    {tab === "menus" && locationId && <MenusPanel orgId={context.organization.id} locationId={locationId} manage={manage} />}
    {tab === "scenes" && locationId && <ScenesPanel orgId={context.organization.id} locationId={locationId} manage={manage} />}
    {tab === "layouts" && locationId && <LayoutsPanel orgId={context.organization.id} locationId={locationId} manage={manage} />}
    {tab === "screens" && <ScreensPanel orgId={context.organization.id} manage={manage} locationId={locationId} />}
    {tab === "sessions" && locationId && <SessionsPanel orgId={context.organization.id} locationId={locationId} manage={manage} userId={context.userId} />}
    {tab === "automations" && <AutomationsPanel orgId={context.organization.id} />}
    {tab === "entitlement" && <EntitlementPanel orgId={context.organization.id} />}
    {!locationId && tab !== "locations" && tab !== "screens" && tab !== "automations" && tab !== "entitlement" && <p className="muted">Select a location first.</p>}
  </div>;
}

const TABS = ["locations", "menus", "scenes", "layouts", "screens", "sessions", "automations", "entitlement"] as const;
type Tab = (typeof TABS)[number];

function Json({ value }: { value: unknown }) {
  return <pre style={{ background: "#111", color: "#0f0", padding: 8, overflow: "auto", maxHeight: 300, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
}

function LocationsPanel({ orgId, manage, locations, onChanged }: { orgId: string; manage: boolean; locations: Locations.Location[]; onChanged: (l: Locations.Location[]) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  async function create() {
    setErr("");
    try { const l = await Locations.createLocation(orgId, { name, slug }); onChanged([...locations, l]); setName(""); setSlug(""); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  return <section>
    <h2>Locations</h2>
    {manage && <div style={{ marginBottom: 8 }}>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
      <button onClick={create}>Create</button>
      {err && <span style={{ color: "red" }}> {err}</span>}
    </div>}
    <Json value={locations} />
  </section>;
}

function MenusPanel({ orgId, locationId, manage }: { orgId: string; locationId: string; manage: boolean }) {
  const [menus, setMenus] = useState<Menus.Menu[]>([]);
  const [name, setName] = useState("");
  const refresh = () => Menus.listMenus(orgId, locationId).then(setMenus);
  useEffect(() => { refresh(); }, [orgId, locationId]);
  return <section>
    <h2>Menus</h2>
    {manage && <div style={{ marginBottom: 8 }}>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => Menus.createMenu(orgId, locationId, name).then(() => { setName(""); refresh(); })}>Create</button>
    </div>}
    <Json value={menus} />
  </section>;
}

function ScenesPanel({ orgId, locationId, manage }: { orgId: string; locationId: string; manage: boolean }) {
  const [scenes, setScenes] = useState<Scenes.Scene[]>([]);
  const [menus, setMenus] = useState<Menus.Menu[]>([]);
  const [name, setName] = useState("");
  const [menuId, setMenuId] = useState("");
  const refresh = () => Scenes.listScenes(orgId, locationId).then(setScenes);
  useEffect(() => { refresh(); Menus.listMenus(orgId, locationId).then(setMenus); }, [orgId, locationId]);
  return <section>
    <h2>Scenes</h2>
    {manage && <div style={{ marginBottom: 8 }}>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
        <option value="">— menu —</option>
        {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button disabled={!menuId} onClick={() => Scenes.createMenuScene(orgId, locationId, name, menuId).then(() => { setName(""); refresh(); })}>Create menu scene</button>
    </div>}
    <Json value={scenes} />
  </section>;
}

function LayoutsPanel({ orgId, locationId, manage }: { orgId: string; locationId: string; manage: boolean }) {
  const [layouts, setLayouts] = useState<Layouts.Layout[]>([]);
  const [name, setName] = useState("");
  const refresh = () => Layouts.listLayouts(orgId, locationId).then(setLayouts);
  useEffect(() => { refresh(); }, [orgId, locationId]);
  return <section>
    <h2>Layouts</h2>
    {manage && <div style={{ marginBottom: 8 }}>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => Layouts.createLayout(orgId, locationId, { name }).then(() => { setName(""); refresh(); })}>Create</button>
    </div>}
    <Json value={layouts} />
  </section>;
}

function ScreensPanel({ orgId, manage, locationId }: { orgId: string; manage: boolean; locationId: string }) {
  const [screens, setScreens] = useState<Screens.Screen[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const refresh = () => Screens.listScreens(orgId).then(setScreens);
  useEffect(() => { refresh(); }, [orgId]);
  async function claim() {
    setErr("");
    try { await callEdgeFunction("screen-claim", { code, name, location_id: locationId }); setCode(""); setName(""); refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  return <section>
    <h2>Screens</h2>
    {manage && <div style={{ marginBottom: 8 }}>
      <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
      <input placeholder="screen name" value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={!locationId} onClick={claim}>Claim ({locationId ? "into selected location" : "select a location first"})</button>
      {err && <span style={{ color: "red" }}> {err}</span>}
    </div>}
    <Json value={screens} />
  </section>;
}

function SessionsPanel({ orgId, locationId, manage, userId }: { orgId: string; locationId: string; manage: boolean; userId: string }) {
  const [sessions, setSessions] = useState<Sessions.DisplaySession[]>([]);
  const [name, setName] = useState("");
  const refresh = () => Sessions.listSessions(orgId, locationId).then(setSessions);
  useEffect(() => { refresh(); }, [orgId, locationId]);
  return <section>
    <h2>Sessions</h2>
    {manage && <div style={{ marginBottom: 8 }}>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => Sessions.createDraftSession(orgId, locationId, name).then(() => { setName(""); refresh(); })}>Create draft</button>
    </div>}
    {sessions.map((s) => <div key={s.id} style={{ marginBottom: 8, borderBottom: "1px solid #333", paddingBottom: 8 }}>
      <b>{s.name}</b> — {s.status} — {s.display_mode}
      {manage && s.status === "draft" && <button onClick={() => Sessions.startSession(orgId, s.id, userId).then(refresh)}>Start</button>}
      {manage && s.status === "active" && <button onClick={() => Sessions.stopSession(orgId, s.id, userId).then(refresh)}>Stop</button>}
    </div>)}
    <Json value={sessions} />
  </section>;
}

function AutomationsPanel({ orgId }: { orgId: string }) {
  const [automations, setAutomations] = useState<Automations.Automation[]>([]);
  useEffect(() => { Automations.listAutomations(orgId).then(setAutomations); }, [orgId]);
  return <section><h2>Automations</h2><Json value={automations} /></section>;
}

function EntitlementPanel({ orgId }: { orgId: string }) {
  const [entitlement, setEntitlement] = useState<Orgs.Entitlement | null>(null);
  useEffect(() => { Orgs.getEntitlement(orgId).then(setEntitlement); }, [orgId]);
  return <section><h2>Entitlement</h2><Json value={entitlement} /></section>;
}
