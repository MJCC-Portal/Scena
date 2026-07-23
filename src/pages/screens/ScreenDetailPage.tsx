import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowsLeftRight, Monitor, PencilSimple, Trash } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Screens from "../../domain/screens";
import { listLocations } from "../../domain/locations";
import type { Location } from "../../domain/locations";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusIndicator } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";

export function ScreenDetailPage() {
  const { screenId } = useParams<{ screenId: string }>();
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const manage = canManage(context.role);

  const [screen, setScreen] = useState<Screens.Screen | null>(null);
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignValue, setReassignValue] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (!screenId) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([Screens.getScreen(context.workspace.id, screenId), listLocations(context.workspace.id)])
      .then(([loadedScreen, loadedLocations]) => {
        if (!active) return;
        setScreen(loadedScreen);
        setLocations(loadedLocations);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [context.workspace.id, screenId]);

  async function handleRename() {
    if (!screen || !renameValue.trim() || renameValue === screen.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const updated = await Screens.renameScreen(context.workspace.id, screen.id, renameValue.trim());
      setScreen(updated);
      toast.show("Display renamed", "success");
      setRenameOpen(false);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't rename Display.", "danger");
    } finally {
      setRenaming(false);
    }
  }

  async function handleReassign() {
    if (!screen || !reassignValue || reassignValue === screen.location_id) {
      setReassignOpen(false);
      return;
    }
    setReassigning(true);
    try {
      const updated = await Screens.reassignScreenLocation(context.workspace.id, screen.id, reassignValue);
      setScreen(updated);
      toast.show("Display reassigned", "success");
      setReassignOpen(false);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't reassign Display.", "danger");
    } finally {
      setReassigning(false);
    }
  }

  async function handleRevoke() {
    if (!screen) return;
    setRevoking(true);
    try {
      await Screens.revokeScreen(context.workspace.id, screen.id);
      toast.show("Display revoked", "success");
      navigate("/app/screens");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't revoke Display.", "danger");
      setRevoking(false);
      setConfirmRevoke(false);
    }
  }

  if (error) {
    return (
      <div className="scena-page">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="scena-page">
        <Skeleton height={320} />
      </div>
    );
  }

  if (!screenId || !screen) {
    return (
      <div className="scena-page">
        <EmptyState
          icon={<Monitor size={32} />}
          title="Display not found"
          description="This Display doesn't exist in this Workspace, or it may have been removed."
          action={
            <Button variant="primary" size="sm" onClick={() => navigate("/app/screens")}>
              Back to Displays
            </Button>
          }
        />
      </div>
    );
  }

  const location = locations?.find((entry) => entry.id === screen.location_id) ?? null;
  const locationOptions = (locations ?? []).map((entry) => ({ value: entry.id, label: entry.name }));

  return (
    <div className="scena-page">
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/screens")}>
        Back to Displays
      </Button>

      <PageHeader
        title={screen.name ?? "Untitled Display"}
        description={location ? `Assigned to ${location.name}` : "Not assigned to a Location"}
        actions={
          manage ? (
            <>
              <Button variant="secondary" icon={<PencilSimple size={18} />} onClick={() => { setRenameValue(screen.name ?? ""); setRenameOpen(true); }}>
                Rename
              </Button>
              <Button variant="secondary" icon={<ArrowsLeftRight size={18} />} onClick={() => { setReassignValue(screen.location_id ?? ""); setReassignOpen(true); }} disabled={locationOptions.length === 0}>
                Reassign
              </Button>
              <Button variant="danger" icon={<Trash size={18} />} onClick={() => setConfirmRevoke(true)} disabled={screen.status === "revoked"}>
                Revoke
              </Button>
            </>
          ) : undefined
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
        <Card>
          <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)", marginBottom: 8 }}>Status</div>
          <StatusIndicator status={isOnline(screen) ? "online" : screen.status} />
          <div style={{ marginTop: 16, fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)", display: "grid", gap: 6 }}>
            <span>Location: {location ? location.name : "—"}</span>
            <span>Last seen: {formatTimestamp(screen.last_seen_at)}</span>
            <span>Paired: {formatTimestamp(screen.claimed_at)}</span>
            {screen.revoked_at && <span>Revoked: {formatTimestamp(screen.revoked_at)}</span>}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)", marginBottom: 8 }}>Record</div>
          <div style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)", display: "grid", gap: 6 }}>
            <span>Created: {formatTimestamp(screen.created_at)}</span>
            <span>Updated: {formatTimestamp(screen.updated_at)}</span>
          </div>
        </Card>
      </div>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename Display"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={renaming}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRename} loading={renaming} disabled={!renameValue.trim()}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Display name" htmlFor="screen-rename-input">
          <Input
            id="screen-rename-input"
            value={renameValue}
            maxLength={80}
            onChange={(event) => setRenameValue(event.target.value)}
          />
        </Field>
      </Modal>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign Display"
        description="Move this Display to another Location. It will show that Location's content."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReassignOpen(false)} disabled={reassigning}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleReassign} loading={reassigning} disabled={!reassignValue}>
              Reassign
            </Button>
          </>
        }
      >
        <Field label="Location" htmlFor="screen-reassign-select">
          <Select
            id="screen-reassign-select"
            value={reassignValue}
            onChange={(event) => setReassignValue(event.target.value)}
            options={locationOptions}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={confirmRevoke}
        title={`Revoke "${screen.name}"?`}
        description="A revoked Display stops receiving content and can't be re-paired without a new pairing code."
        confirmLabel="Revoke"
        danger
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevoke(false)}
      />
    </div>
  );
}

function isOnline(screen: Screens.Screen): boolean {
  if (screen.status !== "ready" || !screen.last_seen_at) return false;
  return Date.now() - new Date(screen.last_seen_at).getTime() < 5 * 60 * 1000;
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}
