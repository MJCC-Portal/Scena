import { useEffect, useRef, useState, type ReactNode } from "react";
import { exchangeMjccCode, loadManagerContext, supabase, type ManagerContext } from "./lib/supabase";
import { createMenuScene, deleteScene, listScenes, updateMenuScene, type MenuSceneConfig, type Scene } from "./lib/scenes";
import { listPresentationAssets, uploadPresentation, type PresentationAsset } from "./lib/presentations";

const mjccPortal = (import.meta.env.VITE_MJCC_PORTAL_URL as string | undefined) ?? "https://mjcc.kpnsolute.com";

type View = "control" | "queue" | "scenes" | "decks" | "music";
type PairedScreen = { name: string; code: string; sceneId: string; online: boolean };

const roleLabels: Record<ManagerContext["membership"]["role"], string> = {
  owner: "Owner", admin: "Administrator", operator: "Operator", viewer: "Viewer",
};

function icon(path: ReactNode) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
function ficon(path: ReactNode) {
  return <svg viewBox="0 0 24 24" fill="currentColor">{path}</svg>;
}
const Icons = {
  monitor: icon(<><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>),
  queue: icon(<path d="M4 7h16M4 12h16M4 17h10" />),
  layers: icon(<><path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5" /></>),
  deck: icon(<><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M3 8h18M12 17v4M8 21h8" /></>),
  music: icon(<><circle cx="8" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M11 18V5l10-2v13" /></>),
  logout: icon(<><path d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" /><path d="M10 12h11m0 0-4-4m4 4-4 4" /></>),
  upload: icon(<path d="M12 16V4M6 10l6-6 6 6M4 20h16" />),
  plus: icon(<path d="M12 5v14M5 12h14" />),
  trash: icon(<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />),
  close: icon(<path d="M6 6l12 12M18 6L6 18" />),
  take: icon(<path d="M5 12h14M13 6l6 6-6 6" />),
  bell: icon(<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />),
  chevron: icon(<path d="M6 9l6 6 6-6" />),
  screen: icon(<rect x="2" y="5" width="20" height="12" rx="2" />),
  zones: icon(<><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="18" height="8" rx="1" /></>),
  frame: icon(<rect x="2" y="4" width="20" height="14" rx="2" />),
  playThumb: ficon(<path d="M10 8l6 4-6 4z" />),
  playerFrame: icon(<><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M10 9l5 3-5 3z" /></>),
  prev: ficon(<path d="M6 6h2v12H6zM20 6l-10 6 10 6z" />),
  next: ficon(<path d="M16 6h2v12h-2zM4 6l10 6-10 6z" />),
  pause: ficon(<path d="M7 5h4v14H7zM13 5h4v14h-4z" />),
  play: ficon(<path d="M8 5l11 7-11 7z" />),
};

const sceneTypeLabels: Record<Scene["scene_type"], string> = {
  menu: "Menu board", queue: "Queue", slideshow: "Slideshow", media: "Media", layout: "Layout",
};

export function App() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [context, setContext] = useState<ManagerContext | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState<View>("control");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(true);
  const [live, setLive] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [screens, setScreens] = useState<PairedScreen[]>([]);
  const [pairOpen, setPairOpen] = useState(false);
  const [serving, setServing] = useState(41);
  const [waiting, setWaiting] = useState(6);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [clock, setClock] = useState("--:--");

  function toast(msg: string) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const iv = setInterval(tick, 10000);
    return () => clearInterval(iv);
  }, []);

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

  const refreshScenes = (orgId: string) => listScenes(orgId)
    .then((next) => { setScenes(next); setLive((current) => current && next.some((s) => s.id === current) ? current : next.find((s) => s.is_active)?.id ?? next[0]?.id ?? null); })
    .catch(() => toast("Could not load scenes"))
    .finally(() => setScenesLoading(false));

  useEffect(() => {
    if (!context) return;
    refreshScenes(context.organization.id);
  }, [context]);

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null); setContext(null); setError("");
  }

  if (busy) return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Loading your MJCC workspace…</p></div></main>;
  if (!user || !context) return <main className="auth-shell"><section className="auth-card">
    <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
    <h1>{user ? "Access unavailable" : "Sign in to Scena"}</h1>
    <p className="muted">{error || "Use your central MJCC account to run boards, queues, and kiosk screens."}</p>
    {error && <div className="error">{error}</div>}
    <button className="btn gold" onClick={() => window.location.assign(`${mjccPortal}/?launch=marquee`)}>Continue with MJCC {Icons.take}</button>
    <p className="fine">Managers sign in once through KpnCompute. Scena never stores a separate manager password.</p>
  </section></main>;

  const canManage = context.membership.role !== "viewer";
  const showing = preview ?? live;
  const showingScene = scenes.find((s) => s.id === showing) ?? null;
  const liveScreenCount = screens.filter((s) => s.online && s.sceneId === live).length;

  function takeLive() {
    if (!preview) return;
    if (!screens.length) { toast("Pair a screen first — nothing is connected"); return; }
    const name = scenes.find((s) => s.id === preview)?.name ?? "Scene";
    setScreens(screens.map((s) => s.online ? { ...s, sceneId: preview } : s));
    setLive(preview); setPreview(null);
    toast(`${name} is live on ${screens.filter((s) => s.online).length} screen(s)`);
  }

  const navGroups: Array<{ label: string; items: Array<{ id: View; label: string; icon: ReactNode; managerOnly?: boolean }> }> = [
    { label: "Front of house", items: [
      { id: "control", label: "Control room", icon: Icons.monitor },
      { id: "queue", label: "Queue", icon: Icons.queue },
    ] },
    { label: "Content", items: [
      { id: "scenes", label: "Scenes", icon: Icons.layers, managerOnly: true },
      { id: "decks", label: "Slide decks", icon: Icons.deck },
      { id: "music", label: "Music", icon: Icons.music },
    ] },
  ];

  return <>
    <header className="topbar">
      <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
      <div className="org">Tenant <b>{context.organization.name}</b> · {roleLabels[context.membership.role]} {Icons.chevron}</div>
      <div className="top-status">
        <span><span className="dot ok" />{screens.filter((s) => s.online).length}/{screens.length} screens online</span>
        <span className="clock">{clock}</span>
      </div>
    </header>
    <div className="shell">
      <nav className="rail" aria-label="Main">
        {navGroups.map((group) => <div key={group.label} style={{ display: "contents" }}>
          <div className="rail-label">{group.label}</div>
          {group.items.filter((item) => !item.managerOnly || canManage).map((item) =>
            <button key={item.id} className={view === item.id ? "nav-btn active" : "nav-btn"} onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span></button>)}
        </div>)}
        <div className="rail-foot">
          <button className="nav-btn" onClick={signOut}>{Icons.logout}<span>Sign out</span></button>
          <small>Scena v0.2<br />KpnCompute</small>
        </div>
      </nav>
      <main className="main">
        {view === "control" && <ControlView scenes={scenes} scenesLoading={scenesLoading} live={live} preview={preview} showingScene={showingScene} liveScreenCount={liveScreenCount} screens={screens} serving={serving} canManage={canManage}
          onPick={(id) => setPreview(id === live ? null : id)} onTake={takeLive} onEdit={() => setView(canManage ? "scenes" : view)} onPair={() => setPairOpen(true)}
          onAssign={(index, sceneId) => { setScreens(screens.map((s, i) => i === index ? { ...s, sceneId } : s)); toast(`${screens[index].name} → ${scenes.find((s) => s.id === sceneId)?.name ?? "scene"}`); }}
          onUnpair={(index) => { const name = screens[index].name; setScreens(screens.filter((_, i) => i !== index)); toast(`${name} unpaired`); }} />}
        {view === "queue" && <QueueView serving={serving} waiting={waiting}
          onCall={() => { if (waiting > 0) { setServing(serving + 1); setWaiting(waiting - 1); toast(`Called ${String(serving + 1).padStart(3, "0")} — chime sent to boards`); } else toast("Queue is empty"); }}
          onRecall={() => toast(`Recalled ${String(serving).padStart(3, "0")}`)} />}
        {view === "scenes" && <ScenesView orgId={context.organization.id} canManage={canManage} scenes={scenes} loading={scenesLoading} onChanged={() => refreshScenes(context.organization.id)} toast={toast} />}
        {view === "decks" && <DecksView orgId={context.organization.id} canManage={canManage} toast={toast} />}
        {view === "music" && <MusicView toast={toast} />}
      </main>
    </div>
    {pairOpen && <PairModal scenes={scenes} screens={screens} onCancel={() => setPairOpen(false)}
      onPair={(screen) => { setScreens([...screens, screen]); setPairOpen(false); toast(`${screen.name} paired — the kiosk is now showing its scene`); }} toast={toast} />}
    <div className={toastMsg ? "toast show" : "toast"} role="status">{toastMsg}</div>
  </>;
}

/* ── Boards ── */

function Board({ scene, serving }: { scene: Scene | null; serving: number }) {
  if (!scene) return <div className="slide-board">Create a scene to light this board up</div>;
  if (scene.scene_type === "menu") {
    const config: MenuSceneConfig = scene.config ?? { title: "", items: [] };
    const half = Math.ceil(config.items.length / 2);
    const col = (items: string[]) => <div>{items.map((item, i) => {
      const [name, price] = item.split("·").map((p) => p.trim());
      return <div className="mi" key={i}><span>{name}</span>{price && <span>{price}</span>}</div>;
    })}</div>;
    return <div className="board"><div className="b-head">{config.title.toUpperCase()}</div>
      <div className="menu-cols">{col(config.items.slice(0, half))}{col(config.items.slice(half))}</div></div>;
  }
  if (scene.scene_type === "queue") return <div className="queue-board"><div className="lbl">Now serving</div>
    <div className="num">{String(serving).padStart(3, "0")}</div>
    <div className="nxt">next · {[1, 2, 3].map((k) => String(serving + k).padStart(3, "0")).join(" · ")}</div></div>;
  return <div className="slide-board">{scene.name} — {sceneTypeLabels[scene.scene_type]} scene</div>;
}

/* ── Control room ── */

function ControlView({ scenes, scenesLoading, live, preview, showingScene, liveScreenCount, screens, serving, canManage, onPick, onTake, onEdit, onPair, onAssign, onUnpair }: {
  scenes: Scene[]; scenesLoading: boolean; live: string | null; preview: string | null; showingScene: Scene | null; liveScreenCount: number; screens: PairedScreen[]; serving: number; canManage: boolean;
  onPick: (id: string) => void; onTake: () => void; onEdit: () => void; onPair: () => void; onAssign: (index: number, sceneId: string) => void; onUnpair: (index: number) => void;
}) {
  const zones = showingScene ? zonesFor(showingScene) : [];
  const statusText = preview ? "preview — not on screens yet"
    : showingScene ? (liveScreenCount ? `live on ${liveScreenCount} screen${liveScreenCount > 1 ? "s" : ""}` : (screens.length ? "live · no screens assigned" : "live · no screens paired"))
    : "no scenes yet";
  return <section>
    <div className="view-head"><h1>Control room</h1><p>Preview a scene, then take it live to your boards.</p></div>
    <div className="stage-grid">
      <div>
        <div className={preview ? "monitor-wrap" : "monitor-wrap live"}>
          <div className="bulb-frame" aria-hidden="true" />
          <div className="monitor">
            <div className={preview ? "tally pvw" : "tally live"}><span className="lamp" />{preview ? "PREVIEW" : "LIVE"}</div>
            <div className="monitor-content"><Board scene={showingScene} serving={serving} /></div>
          </div>
          <div className="monitor-bar">
            <span className="scene-name">{showingScene?.name ?? "No scene"}</span>
            <span className="on-screens">{statusText}</span>
            <span className="spacer" />
            {canManage && <button className="btn" onClick={onEdit}>Edit scene</button>}
            {preview && <button className="btn gold" onClick={onTake}>{Icons.take}Take live</button>}
          </div>
        </div>
        <div className="strip-label">Scenes</div>
        {scenesLoading ? <div className="skeleton-list"><div className="skeleton-row" /><div className="skeleton-row" /></div>
          : scenes.length === 0 ? <div className="empty">{Icons.layers}No scenes yet.<br />Create one in the Scenes tab to light up your boards.</div>
          : <div className="scene-strip">{scenes.map((sc) => <button key={sc.id} className={"scene-card" + (sc.id === live ? " is-live" : "") + (sc.id === preview ? " is-pvw" : "")} onClick={() => onPick(sc.id)}>
            <div className="thumb">{sc.id === live && <span className="flag">LIVE</span>}{sc.id === preview && <span className="flag">PVW</span>}{Icons.frame}</div>
            <div className="nm">{sc.name}</div><div className="tp">{sceneTypeLabels[sc.scene_type]}</div>
          </button>)}</div>}
      </div>
      <div className="side-stack">
        <div className="panel">
          <h2>{Icons.screen}Screens{canManage && <button className="btn" onClick={onPair}>+ Pair</button>}</h2>
          {screens.length === 0 ? <div className="empty">{Icons.screen}No screens paired yet.<br />Open the display URL on a kiosk, then enter its code here.</div>
            : screens.map((s, index) => {
              const isLive = s.online && s.sceneId === live;
              return <div className="screen-row" key={s.code}>
                <span className={"st " + (s.online ? (isLive ? "live" : "on") : "off")} />
                <div className="meta"><b>{s.name}</b><span>{s.online ? (isLive ? "Live" : "Online") : "Offline"} · {s.code}</span></div>
                <select aria-label={`Scene for ${s.name}`} value={s.sceneId} onChange={(e) => onAssign(index, e.target.value)}>
                  {scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                </select>
                <button className="rm" aria-label={`Unpair ${s.name}`} onClick={() => onUnpair(index)}>{Icons.close}</button>
              </div>;
            })}
        </div>
        <div className="panel">
          <h2>{Icons.zones}Scene zones</h2>
          {zones.length === 0 ? <div className="empty">{Icons.zones}Pick a scene to see its zones.</div>
            : zones.map(([nm, src]) => <div className="zone-row" key={nm}>{Icons.frame}{nm}<span className="tag">{src}</span></div>)}
        </div>
      </div>
    </div>
  </section>;
}

function zonesFor(scene: Scene): Array<[string, string]> {
  switch (scene.scene_type) {
    case "menu": return [["Menu grid", `menu:${scene.name.toLowerCase().replace(/\s+/g, "-")}`], ["Ticker", "text:hours"], ["Logo", "asset:logo"]];
    case "queue": return [["Now serving", "queue:station-1"], ["Up next", "queue:next-3"], ["Chime", "audio:bell"]];
    case "slideshow": return [["Slides", "deck:pptx"], ["Clock", "widget:clock"]];
    case "media": return [["Player", "yt:iframe"], ["Track info", "yt:meta"]];
    default: return [["Layout", "layout:custom"]];
  }
}

/* ── Queue ── */

function QueueView({ serving, waiting, onCall, onRecall }: { serving: number; waiting: number; onCall: () => void; onRecall: () => void }) {
  const tickets = [];
  for (let i = 0; i < 7; i++) {
    const n = serving - 2 + i;
    if (n < 1) continue;
    tickets.push({ n, st: n < serving ? "served" : n === serving ? "called" : "wait" });
  }
  return <section>
    <div className="view-head"><h1>Queue</h1><p>Calls push to every queue board instantly.</p></div>
    <div className="queue-grid">
      <div className="panel serving-card">
        <div className="lbl">Now serving</div>
        <div className="num">{String(serving).padStart(3, "0")}</div>
        <div className="sub">{Math.max(waiting, 0)} waiting · station 1</div>
        <div className="q-actions">
          <button className="btn gold" onClick={onCall}>{Icons.bell}Call next</button>
          <button className="btn" onClick={onRecall}>Recall</button>
        </div>
      </div>
      <div className="panel">
        <h2>Tickets today</h2>
        {tickets.map(({ n, st }) => <div className="tk-row" key={n}>
          <span className="tn">{String(n).padStart(3, "0")}</span>
          <span className="tl">{st === "wait" ? "Waiting" : st === "called" ? "At the counter" : "Served"}</span>
          <span className={`ts ${st}`}>{st.toUpperCase()}</span>
        </div>)}
      </div>
    </div>
  </section>;
}

/* ── Scenes editor ── */

function ScenesView({ orgId, canManage, scenes, loading, onChanged, toast }: { orgId: string; canManage: boolean; scenes: Scene[]; loading: boolean; onChanged: () => void; toast: (m: string) => void }) {
  const [selected, setSelected] = useState<Scene | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function newScene() {
    setError("");
    setSelected({ id: "", org_id: orgId, name: "New menu", scene_type: "menu", config: { title: "Today's menu", items: ["Add your first item"] }, is_active: true, created_at: "", updated_at: "" });
  }
  async function save(scene: Scene) {
    if (!scene.name.trim() || !scene.config.title.trim() || scene.config.items.some((item) => !item.trim())) { setError("Give the scene, title, and every menu item a value."); return; }
    setSaving(true); setError("");
    try {
      const saved = scene.id ? await updateMenuScene(scene.id, scene.name, scene.config, scene.is_active) : await createMenuScene(orgId, scene.name, scene.config);
      setSelected(saved); onChanged(); toast("Scene saved");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save scene"); } finally { setSaving(false); }
  }
  async function remove(scene: Scene) {
    if (!scene.id || !window.confirm(`Delete ${scene.name}?`)) return;
    setSaving(true); setError("");
    try { await deleteScene(scene.id); setSelected(null); onChanged(); toast("Scene deleted"); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete scene"); } finally { setSaving(false); }
  }

  return <section>
    <div className="view-head"><h1>Scenes</h1><p>Boards your screens can show — menus, queues, slideshows.</p><span className="spacer" />
      {canManage && <button className="btn gold" onClick={newScene}>{Icons.plus}New scene</button>}</div>
    {error && <div className="error" style={{ marginBottom: 14 }}>{error}</div>}
    <div className="scene-editor-grid">
      <div className="panel">
        <h2>{Icons.layers}All scenes</h2>
        {loading ? <div className="skeleton-list"><div className="skeleton-row" /><div className="skeleton-row" /></div>
          : scenes.length === 0 ? <div className="empty">{Icons.layers}No scenes yet.<br />Create a menu scene for your first board.</div>
          : <div className="scene-list">{scenes.map((scene) => <button key={scene.id} className={selected?.id === scene.id ? "scene-item selected" : "scene-item"} onClick={() => setSelected(scene)}>
            {Icons.frame}<div className="meta"><b>{scene.name}</b><span>{sceneTypeLabels[scene.scene_type]} · {scene.is_active ? "Active" : "Inactive"}</span></div>
          </button>)}</div>}
      </div>
      {selected ? <div className="panel">
        <h2>{Icons.frame}{selected.id ? "Edit scene" : "Create scene"}<span className={selected.is_active ? "state-badge live" : "state-badge"}>{selected.is_active ? "ACTIVE" : "INACTIVE"}</span></h2>
        <label className="form-label">Scene name</label>
        <input className="form-input" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} disabled={!canManage || saving} />
        <label className="form-label">Display title</label>
        <input className="form-input" value={selected.config.title} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, title: e.target.value } })} disabled={!canManage || saving} />
        <label className="form-label">Menu items — use "Name · Price"</label>
        {selected.config.items.map((item, index) => <div className="item-line" key={index}>
          <input className="form-input" value={item} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, items: selected.config.items.map((c, i) => i === index ? e.target.value : c) } })} disabled={!canManage || saving} />
          <button className="icon-button" onClick={() => setSelected({ ...selected, config: { ...selected.config, items: selected.config.items.filter((_, i) => i !== index) } })} disabled={!canManage || saving} aria-label="Remove item">{Icons.trash}</button>
        </div>)}
        <button className="add-item" onClick={() => setSelected({ ...selected, config: { ...selected.config, items: [...selected.config.items, ""] } })} disabled={!canManage || saving}>{Icons.plus}Add item</button>
        <label className="toggle-line"><input type="checkbox" checked={selected.is_active} onChange={(e) => setSelected({ ...selected, is_active: e.target.checked })} disabled={!canManage || saving} /> Available for the control room</label>
        <div className="editor-actions">
          <button className="btn danger" onClick={() => remove(selected)} disabled={!canManage || saving || !selected.id}>Delete</button>
          <button className="btn gold" onClick={() => save(selected)} disabled={!canManage || saving}>{saving ? "Saving…" : "Save scene"}</button>
        </div>
      </div> : <div className="panel"><div className="empty">{Icons.frame}Select a scene to edit it,<br />or create a new one.</div></div>}
    </div>
  </section>;
}

/* ── Decks ── */

function DecksView({ orgId, canManage, toast }: { orgId: string; canManage: boolean; toast: (m: string) => void }) {
  const [assets, setAssets] = useState<PresentationAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => listPresentationAssets(orgId).then(setAssets).catch(() => toast("Could not load decks")).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, [orgId]);

  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    toast("Uploading — this may take a moment");
    try { await uploadPresentation(file); await refresh(); toast(`${file.name} uploaded — conversion arrives in a later phase`); }
    catch (err) { toast(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  const badge = (status: PresentationAsset["status"]) =>
    status === "ready" ? <span className="badge ready">READY</span>
    : status === "failed" ? <span className="badge fail">FAILED</span>
    : status === "processing" ? <span className="badge conv">CONVERTING</span>
    : <span className="badge conv">{status === "pending_upload" ? "UPLOADING" : "UPLOADED"}</span>;
  const formatSize = (bytes: number | null) => bytes === null ? "" : bytes >= 1048576 ? ` · ${(bytes / 1048576).toFixed(1)} MB` : ` · ${Math.max(1, Math.round(bytes / 1024))} KB`;

  return <section>
    <div className="view-head"><h1>Slide decks</h1><p>PowerPoints convert to slides automatically, then run as scenes.</p></div>
    <button className={"dropzone" + (drag ? " drag" : "") + (!canManage || uploading ? " disabled" : "")}
      onClick={() => fileInput.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); setDrag(true); }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
      aria-label="Upload a PowerPoint">
      {Icons.upload}
      <b>{uploading ? "Uploading…" : "Drop a PowerPoint here"}</b>
      <span>.pptx up to 100 MB · converts to a board-ready slideshow</span>
    </button>
    <input type="file" ref={fileInput} hidden accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    {loading ? <div className="skeleton-list"><div className="skeleton-row" /><div className="skeleton-row" /></div>
      : assets.length === 0 ? <div className="empty">{Icons.deck}No decks yet.<br />Upload a PowerPoint to get started.</div>
      : <div className="deck-grid">{assets.map((asset) => <div className="deck" key={asset.id}>
        <div className="slides"><div className="sl c1" /><div className="sl c2" /><div className="sl c3" /><div className="sl c1" /></div>
        <div className="body">
          <b>{asset.original_filename}</b>
          <span>{new Date(asset.created_at).toLocaleDateString()}{formatSize(asset.size_bytes)}</span>
          <div className="row">{badge(asset.status)}
            {asset.status === "ready" && <button className="btn" onClick={() => toast("Deck-to-scene conversion arrives with the processing worker")}>Make scene</button>}
          </div>
        </div>
      </div>)}</div>}
  </section>;
}

/* ── Music ── */

const musicResults = [
  { t: "Coffeehouse jazz — relaxing background music", c: "Cafe Music BGM", d: "3:02:11" },
  { t: "Smooth jazz & bossa nova for work", c: "Relax Jazz Cafe", d: "2:14:40" },
  { t: "Morning coffee shop ambience with jazz", c: "Cozy Rain", d: "1:58:03" },
  { t: "Sunday brunch jazz playlist", c: "Jazz Lounge", d: "2:45:22" },
];

function MusicView({ toast }: { toast: (m: string) => void }) {
  const [playing, setPlaying] = useState(true);
  const [playlist, setPlaylist] = useState([
    { t: "Lofi coffeehouse mix — 3 hours", d: "3:00:14", playing: true },
    { t: "Acoustic covers of popular songs", d: "1:42:55", playing: false },
    { t: "Smooth jazz & bossa nova for work", d: "2:14:40", playing: false },
  ]);
  return <section>
    <div className="view-head"><h1>Music</h1><p>Search YouTube, queue tracks, control playback on your screens.</p></div>
    <div className="music-grid">
      <div>
        <div className="search-row">
          <input type="search" placeholder="Search YouTube — try 'coffeehouse jazz'" aria-label="Search YouTube" />
          <button className="btn" onClick={() => toast("YouTube search connects in a later phase")}>Search</button>
        </div>
        <div className="panel">
          <h2>Results</h2>
          {musicResults.map((x) => <div className="yt-result" key={x.t}>
            <div className="yt-thumb">{Icons.playThumb}</div>
            <div className="meta"><b>{x.t}</b><span>{x.c} · {x.d}</span></div>
            <button className="btn" onClick={() => { setPlaylist([...playlist, { t: x.t, d: x.d, playing: false }]); toast("Added to Open hours"); }}>Add</button>
          </div>)}
        </div>
      </div>
      <div className="side-stack">
        <div className="panel np-card">
          <div className="frame">{Icons.playerFrame}Player visible on screen</div>
          <b>{playlist.find((p) => p.playing)?.t ?? "Nothing playing"}</b>
          <span>Playback lands with the kiosk player</span>
          <div className="transport">
            <button className="tb" aria-label="Previous track" onClick={() => toast("Previous track")}>{Icons.prev}</button>
            <button className="tb main" aria-label="Play or pause" onClick={() => { setPlaying(!playing); toast(playing ? "Paused" : "Resumed"); }}>{playing ? Icons.pause : Icons.play}</button>
            <button className="tb" aria-label="Next track" onClick={() => toast("Skipped")}>{Icons.next}</button>
          </div>
        </div>
        <div className="panel">
          <h2>Playlist · Open hours</h2>
          {playlist.map((x, i) => <div className={x.playing ? "pl-item playing" : "pl-item"} key={`${i}-${x.t}`}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span><span className="t">{x.t}</span><span className="d">{x.d}</span>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

/* ── Pair modal ── */

function PairModal({ scenes, screens, onCancel, onPair, toast }: { scenes: Scene[]; screens: PairedScreen[]; onCancel: () => void; onPair: (s: PairedScreen) => void; toast: (m: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  function confirm() {
    if (code.length !== 6) { toast("Enter the 6-digit code shown on the kiosk"); return; }
    if (!name.trim()) { toast("Give the screen a name"); return; }
    if (screens.some((s) => s.code === code)) { toast("That code is already paired"); return; }
    onPair({ name: name.trim(), code, sceneId, online: true });
  }
  return <div className="modal-veil" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pair-title">
      <h3 id="pair-title">Pair a screen</h3>
      <p className="hint">On the kiosk, open your display URL. It shows a 6-digit code. Enter it here to claim that screen.</p>
      <label htmlFor="pair-code">Pairing code</label>
      <input className="code-input" id="pair-code" inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="off" autoFocus
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
      <label htmlFor="pair-name">Screen name</label>
      <input id="pair-name" placeholder="Front Counter Left" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="pair-scene">Starting scene</label>
      <select id="pair-scene" value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
        {scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
      </select>
      <div className="m-actions">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn gold" onClick={confirm}>Pair screen</button>
      </div>
    </div>
  </div>;
}
