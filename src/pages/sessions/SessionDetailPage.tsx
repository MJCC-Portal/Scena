import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Broadcast, Check, Monitor, PencilSimple, Play, Plus, Star, Stop, Trash, X } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Sessions from "../../domain/sessions";
import * as Screens from "../../domain/screens";
import type { DisplayMode } from "../../shared/validation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusIndicator } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Switch } from "../../components/ui/Checkbox";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";

// duplicate/extend require a shared_layout_id (enforced by setDisplayMode and
// the display_sessions_check constraint). Shared-layout selection is not part
// of this page yet, so only the modes that forbid a shared layout are offered.
const OFFERED_MODES: DisplayMode[] = ["independent", "single"];

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const manage = canManage(context.role);

  const [session, setSession] = useState<Sessions.SessionWithScreens | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [locationScreens, setLocationScreens] = useState<Screens.Screen[]>([]);

  // Header rename state
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Lifecycle action state
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add-display state
  const [addOpen, setAddOpen] = useState(false);
  const [availableScreens, setAvailableScreens] = useState<Screens.Screen[] | null>(null);
  const [addScreenId, setAddScreenId] = useState("");
  const [adding, setAdding] = useState(false);

  function refresh() {
    if (!sessionId) return;
    setError(null);
    Sessions.getSession(context.workspace.id, sessionId)
      .then((result) => {
        if (!result) {
          setNotFound(true);
          return;
        }
        setSession(result);
        // Session-screen rows carry screen_id only — resolve display names
        // from the location's screen list (assigned screens may no longer be
        // 'ready', so listScreens rather than listAvailableScreens here).
        return Screens.listScreens(context.workspace.id, result.location_id).then(setLocationScreens);
      })
      .catch(setError);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [context.workspace.id, sessionId]);

  function showError(err: unknown, fallback: string) {
    toast.show(err instanceof Error ? err.message : fallback, "danger");
  }

  async function saveName() {
    if (!session || !nameDraft.trim()) return;
    setSavingName(true);
    try {
      const updated = await Sessions.renameSession(context.workspace.id, session.id, nameDraft.trim());
      setSession({ ...session, ...updated });
      setRenaming(false);
    } catch (err) {
      showError(err, "Couldn't rename Session.");
    } finally {
      setSavingName(false);
    }
  }

  // Status machine (from src/domain/sessions.ts): draft -> active (start),
  // active -> stopped (stop), draft-only delete. 'stopped' is terminal and
  // the handle_display_session_status trigger releases all screens on stop.
  async function start() {
    if (!session) return;
    setStarting(true);
    try {
      await Sessions.startSession(context.workspace.id, session.id, context.userId);
      refresh();
    } catch (err) {
      showError(err, "Couldn't start Session.");
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    if (!session) return;
    setStopping(true);
    try {
      await Sessions.stopSession(context.workspace.id, session.id, context.userId);
      refresh();
    } catch (err) {
      showError(err, "Couldn't stop Session.");
    } finally {
      setStopping(false);
    }
  }

  async function deleteDraft() {
    if (!session) return;
    setDeleting(true);
    try {
      await Sessions.deleteDraftSession(context.workspace.id, session.id);
      toast.show("Draft Session deleted", "success");
      navigate("/app/sessions");
    } catch (err) {
      showError(err, "Couldn't delete Session.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function changeMode(mode: DisplayMode) {
    if (!session || mode === session.display_mode) return;
    try {
      // Only independent/single are offered, both of which forbid a shared
      // layout — so sharedLayoutId is always null here.
      const updated = await Sessions.setDisplayMode(context.workspace.id, session.id, mode, null);
      setSession({ ...session, ...updated });
    } catch (err) {
      showError(err, "Couldn't change display mode.");
    }
  }

  function openAdd() {
    if (!session) return;
    setAddScreenId("");
    setAvailableScreens(null);
    setAddOpen(true);
    Screens.listAvailableScreens(context.workspace.id, session.location_id)
      .then(setAvailableScreens)
      .catch((err) => {
        setAddOpen(false);
        showError(err, "Couldn't load available Displays.");
      });
  }

  async function addScreen() {
    if (!session || !addScreenId) return;
    setAdding(true);
    try {
      await Sessions.addScreenToSession(context.workspace.id, session.location_id, session.id, {
        screen_id: addScreenId,
        is_primary: session.screens.length === 0,
        screen_order: session.screens.length,
      });
      setAddOpen(false);
      refresh();
    } catch (err) {
      showError(err, "Couldn't add Display.");
    } finally {
      setAdding(false);
    }
  }

  async function removeScreen(sessionScreenId: string) {
    try {
      await Sessions.removeScreenFromSession(context.workspace.id, sessionScreenId);
      refresh();
    } catch (err) {
      showError(err, "Couldn't remove Display.");
    }
  }

  async function makePrimary(sessionScreenId: string) {
    if (!session) return;
    try {
      await Sessions.setPrimaryScreen(context.workspace.id, session.id, sessionScreenId);
      refresh();
    } catch (err) {
      showError(err, "Couldn't set primary Display.");
    }
  }

  async function toggleEnabled(screen: Sessions.SessionScreen) {
    try {
      await Sessions.updateSessionScreen(context.workspace.id, screen.id, { is_enabled: !screen.is_enabled });
      refresh();
    } catch (err) {
      showError(err, "Couldn't update Display.");
    }
  }

  if (notFound) {
    return (
      <div className="scena-page">
        <EmptyState
          icon={<Broadcast size={32} />}
          title="Session not found"
          description="This Session doesn't exist in this Workspace, or it was deleted."
          action={<Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/sessions")}>Back to Sessions</Button>}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="scena-page">
        <ErrorBanner error={error} onRetry={refresh} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="scena-page">
        <Skeleton height={72} />
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      </div>
    );
  }

  const screenNames = new Map(locationScreens.map((screen) => [screen.id, screen.name]));
  const assignedIds = new Set(session.screens.map((screen) => screen.screen_id));
  const addableScreens = (availableScreens ?? []).filter((screen) => !assignedIds.has(screen.id));
  // Screen composition is meaningless once a session stops — the status
  // trigger already released every screen — so composer edits stop there.
  const composable = manage && session.status !== "stopped";

  return (
    <div className="scena-page">
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/sessions")}>
        Back to Sessions
      </Button>

      {renaming ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <Input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveName();
              if (event.key === "Escape") setRenaming(false);
            }}
            style={{ maxWidth: 320 }}
            autoFocus
          />
          <Button variant="primary" size="sm" icon={<Check size={16} />} loading={savingName} disabled={!nameDraft.trim()} onClick={saveName}>
            Save
          </Button>
          <Button variant="ghost" size="sm" icon={<X size={16} />} onClick={() => setRenaming(false)} disabled={savingName}>
            Cancel
          </Button>
        </div>
      ) : (
        <PageHeader
          title={session.name}
          description={`Created ${new Date(session.created_at).toLocaleString()}`}
          actions={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusIndicator status={session.status} />
              {manage && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PencilSimple size={16} />}
                  onClick={() => {
                    setNameDraft(session.name);
                    setRenaming(true);
                  }}
                >
                  Rename
                </Button>
              )}
              {manage && session.status === "draft" && (
                <Button variant="primary" size="sm" icon={<Play size={16} />} loading={starting} onClick={start}>
                  Start
                </Button>
              )}
              {manage && session.status === "active" && (
                <Button variant="danger" size="sm" icon={<Stop size={16} />} loading={stopping} onClick={stop}>
                  Stop
                </Button>
              )}
              {manage && session.status === "draft" && (
                <Button variant="danger" size="sm" icon={<Trash size={16} />} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          }
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>Display mode</div>
          <Field label="Mode" hint="Duplicate and extend modes need a shared layout and aren't available yet.">
            <Select
              value={session.display_mode}
              onChange={(event) => changeMode(event.target.value as DisplayMode)}
              disabled={!composable}
              options={[
                // Keep the current mode visible even if it isn't offerable
                // (e.g. a duplicate/extend session created elsewhere).
                ...(OFFERED_MODES.includes(session.display_mode as DisplayMode) ? [] : [{ value: session.display_mode, label: session.display_mode }]),
                ...OFFERED_MODES.map((mode) => ({ value: mode, label: mode })),
              ]}
            />
          </Field>
          <div style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)", display: "grid", gap: 6 }}>
            <span>Started: {session.started_at ? new Date(session.started_at).toLocaleString() : "—"}</span>
            <span>Stopped: {session.stopped_at ? new Date(session.stopped_at).toLocaleString() : "—"}</span>
          </div>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>
              Displays ({session.screens.length})
            </div>
            {composable && (
              <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={openAdd}>
                Add display
              </Button>
            )}
          </div>

          {session.screens.length === 0 ? (
            <EmptyState
              icon={<Monitor size={32} />}
              title="No Displays assigned"
              description={
                session.status === "stopped"
                  ? "Stopping a Session releases its Displays."
                  : "Add a Display so this Session has somewhere to play."
              }
              action={composable ? <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={openAdd}>Add display</Button> : undefined}
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {session.screens.map((screen) => (
                <div
                  key={screen.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "10px 12px",
                    background: "var(--scena-surface-2)",
                    borderRadius: "var(--scena-radius-md)",
                  }}
                >
                  <Monitor size={20} style={{ color: "var(--scena-text-muted)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {screenNames.get(screen.screen_id) ?? "Unknown display"}
                      {screen.is_primary && <Star size={14} weight="fill" style={{ color: "var(--scena-text-muted)" }} aria-label="Primary" />}
                    </div>
                    <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                      Order {screen.screen_order}
                      {screen.rotation_degrees ? ` · ${screen.rotation_degrees}°` : ""}
                    </div>
                  </div>
                  {composable ? (
                    <>
                      <Switch checked={screen.is_enabled} onChange={() => toggleEnabled(screen)} label={screen.is_enabled ? "Enabled" : "Disabled"} />
                      {!screen.is_primary && (
                        <Button variant="ghost" size="sm" icon={<Star size={16} />} onClick={() => makePrimary(screen.id)}>
                          Set primary
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon={<Trash size={16} />} onClick={() => removeScreen(screen.id)}>
                        Remove
                      </Button>
                    </>
                  ) : (
                    <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                      {screen.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={addOpen}
        onClose={() => !adding && setAddOpen(false)}
        title="Add a Display"
        description="Only paired, ready Displays at this Session's location can be added."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addScreen} loading={adding} disabled={!addScreenId}>
              Add display
            </Button>
          </>
        }
      >
        {!availableScreens ? (
          <Skeleton height={40} />
        ) : addableScreens.length === 0 ? (
          <EmptyState icon={<Monitor size={32} />} title="No Displays available" description="Every ready Display at this location is already assigned, or none are paired yet." />
        ) : (
          <Field label="Display">
            <Select
              value={addScreenId}
              onChange={(event) => setAddScreenId(event.target.value)}
              options={[{ value: "", label: "Select a display" }, ...addableScreens.map((screen) => ({ value: screen.id, label: screen.name }))]}
            />
          </Field>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft Session?"
        description="Only draft Sessions can be deleted. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={deleteDraft}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
