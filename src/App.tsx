import { useEffect, useState } from "react";
import { exchangeMjccCode, loadManagerContext, supabase, type ManagerContext } from "./lib/supabase";
import { createMenuScene, deleteScene, listScenes, updateMenuScene, type MenuSceneConfig, type Scene } from "./lib/scenes";
import { listPresentationAssets, uploadPresentation, type PresentationAsset } from "./lib/presentations";

const mjccPortal = (import.meta.env.VITE_MJCC_PORTAL_URL as string | undefined) ?? "https://mjcc.kpnsolute.com";

type View = "overview" | "scenes" | "presentations" | "sessions" | "displays";

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
    <div className="mark">M</div><p className="eyebrow">MJCC OPERATIONS</p><h1>{user ? "Access unavailable" : "Sign in to Scena"}</h1>
    <p className="muted">{error || "Use your central MJCC account to manage display sessions and kiosk streams."}</p>
    {error && <div className="error">{error}</div>}
    <button className="primary" onClick={() => window.location.assign(`${mjccPortal}/?launch=marquee`)}>Continue with MJCC <span>→</span></button>
    <p className="fine">Managers sign in once through KpnCompute. Scena never stores a separate manager password.</p>
  </section></main>;

  const canManage = context.membership.role !== "viewer";
  const nav: Array<{ id: View; label: string; icon: string; managerOnly?: boolean }> = [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "scenes", label: "Scenes", icon: "✦", managerOnly: true },
    { id: "presentations", label: "Presentations", icon: "▤" },
    { id: "sessions", label: "Sessions", icon: "▶", managerOnly: true },
    { id: "displays", label: "Displays", icon: "▣" },
  ];
  return <main className="portal-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="mini-mark">M</div><span>Scena</span></div>
      <div className="org-switcher"><span className="org-dot" />{context.organization.name}<small>{roleLabels[context.membership.role]}</small></div>
      <nav>{nav.filter((item) => !item.managerOnly || canManage).map((item) => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="sidebar-foot"><button className="nav-item" onClick={signOut}><span>↪</span>Sign out</button><small>MJCC · Scena</small></div>
    </aside>
    <section className="portal-main">
      <header className="topbar"><div><p className="eyebrow">MANAGER PORTAL</p><h2>{nav.find((item) => item.id === view)?.label}</h2></div><div className="profile-chip"><span className="avatar">{String(user.email ?? "M").slice(0, 1).toUpperCase()}</span><span>{String(user.email ?? "MJCC manager")}</span></div></header>
      {view === "overview" && <Overview context={context} canManage={canManage} onNavigate={setView} />}
      {view === "scenes" && <ScenesView orgId={context.organization.id} canManage={canManage} />}
      {view === "presentations" && <PresentationsView orgId={context.organization.id} canManage={canManage} />}
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

function PresentationsView({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [assets, setAssets] = useState<PresentationAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => listPresentationAssets(orgId).then(setAssets).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load presentations")).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, [orgId]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError("");
    try { await uploadPresentation(file); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Presentation upload failed"); } finally { setUploading(false); }
  }

  const statusLabels: Record<PresentationAsset["status"], string> = {
    pending_upload: "Uploading…", uploaded: "Uploaded", processing: "Processing", ready: "Ready", failed: "Failed",
  };
  const formatSize = (bytes: number | null) => bytes === null ? "—" : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return <div className="content"><div className="scene-list-card"><div className="section-head"><div><p className="eyebrow">ASSETS</p><h3>Presentations</h3></div><label className={canManage && !uploading ? "primary compact upload-label" : "primary compact upload-label disabled"}>{uploading ? "Uploading…" : "Upload .pptx"}<input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden disabled={!canManage || uploading} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} /></label></div>{error && <div className="error scene-error">{error}</div>}{loading ? <p className="muted">Loading presentations…</p> : assets.length === 0 ? <div className="list-empty"><div className="empty-icon">▤</div><p>No presentations yet.</p><small>Upload a PowerPoint deck to prepare it for kiosk display.</small></div> : <div className="scene-list">{assets.map((asset) => <div key={asset.id} className="scene-row"><span className="scene-row-icon">▤</span><span><strong>{asset.original_filename}</strong><small>{statusLabels[asset.status]} · {formatSize(asset.size_bytes)} · {asset.created_at ? new Date(asset.created_at).toLocaleString() : ""}</small></span></div>)}</div>}</div></div>;
}

function ScenesView({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selected, setSelected] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => listScenes(orgId).then(setScenes).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load scenes")).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, [orgId]);

  function newScene() {
    setError("");
    setSelected({ id: "", org_id: orgId, name: "New menu", scene_type: "menu", config: { title: "Today's menu", items: ["Add your first item"] }, is_active: true, created_at: "", updated_at: "" });
  }
  async function save(scene: Scene) {
    if (!scene.name.trim() || !scene.config.title.trim() || scene.config.items.some((item) => !item.trim())) { setError("Give the scene, title, and every menu item a value."); return; }
    setSaving(true); setError("");
    try {
      const saved = scene.id ? await updateMenuScene(scene.id, scene.name, scene.config, scene.is_active) : await createMenuScene(orgId, scene.name, scene.config);
      setSelected(saved); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save scene"); } finally { setSaving(false); }
  }
  async function remove(scene: Scene) {
    if (!scene.id || !window.confirm(`Delete ${scene.name}?`)) return;
    setSaving(true); setError("");
    try { await deleteScene(scene.id); setSelected(null); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not delete scene"); } finally { setSaving(false); }
  }

  return <div className="content scene-layout"><div className="scene-list-card"><div className="section-head"><div><p className="eyebrow">CONTENT</p><h3>Scenes</h3></div><button className="primary compact" disabled={!canManage} onClick={newScene}>New scene</button></div>{error && <div className="error scene-error">{error}</div>}{loading ? <p className="muted">Loading scenes…</p> : scenes.length === 0 ? <div className="list-empty"><div className="empty-icon">✦</div><p>No scenes yet.</p><small>Create a menu scene for your first kiosk display.</small></div> : <div className="scene-list">{scenes.map((scene) => <button key={scene.id} className={selected?.id === scene.id ? "scene-row selected" : "scene-row"} onClick={() => setSelected(scene)}><span className="scene-row-icon">✦</span><span><strong>{scene.name}</strong><small>{scene.scene_type} · {scene.is_active ? "Active" : "Inactive"}</small></span></button>)}</div>}</div>{selected && <SceneEditor scene={selected} saving={saving} canManage={canManage} onChange={setSelected} onSave={save} onDelete={remove} />}</div>;
}

function SceneEditor({ scene, saving, canManage, onChange, onSave, onDelete }: { scene: Scene; saving: boolean; canManage: boolean; onChange: (scene: Scene) => void; onSave: (scene: Scene) => void; onDelete: (scene: Scene) => void }) {
  const config: MenuSceneConfig = scene.config ?? { title: "", items: [] };
  const setConfig = (next: Partial<MenuSceneConfig>) => onChange({ ...scene, config: { ...config, ...next } });
  return <div className="editor-card"><div className="section-head"><div><p className="eyebrow">MENU SCENE</p><h3>{scene.id ? "Edit scene" : "Create scene"}</h3></div><span className={scene.is_active ? "state-badge live" : "state-badge"}>{scene.is_active ? "Active" : "Inactive"}</span></div><label className="form-label">Scene name<input className="form-input" value={scene.name} onChange={(event) => onChange({ ...scene, name: event.target.value })} disabled={!canManage || saving} /></label><label className="form-label">Display title<input className="form-input" value={config.title} onChange={(event) => setConfig({ title: event.target.value })} disabled={!canManage || saving} /></label><div className="form-label">Menu items<div className="item-editor">{config.items.map((item, index) => <div className="item-line" key={`${index}-${item}`}><input className="form-input" value={item} onChange={(event) => setConfig({ items: config.items.map((current, currentIndex) => currentIndex === index ? event.target.value : current) })} disabled={!canManage || saving} /><button className="icon-button" onClick={() => setConfig({ items: config.items.filter((_, currentIndex) => currentIndex !== index) })} disabled={!canManage || saving} aria-label="Remove item">×</button></div>)}</div><button className="add-item" onClick={() => setConfig({ items: [...config.items, ""] })} disabled={!canManage || saving}>+ Add item</button></div><label className="toggle-line"><input type="checkbox" checked={scene.is_active} onChange={(event) => onChange({ ...scene, is_active: event.target.checked })} disabled={!canManage || saving} /> Available for sessions</label><div className="editor-actions"><button className="secondary compact" onClick={() => onDelete(scene)} disabled={!canManage || saving || !scene.id}>Delete</button><button className="primary compact" onClick={() => onSave(scene)} disabled={!canManage || saving}>{saving ? "Saving…" : "Save scene"}</button></div></div>;
}
