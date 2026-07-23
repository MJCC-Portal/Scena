// /app/locations — physical sites that Displays and Sessions are scoped
// to. Real domain calls: list/create/rename/activate-deactivate via
// src/domain/locations.ts (locations are never deleted, only deactivated,
// so history referencing them stays intact).

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MapPin, PencilSimple, Plus, Power } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button, IconButton } from "../../components/ui/Button";
import { StatusIndicator } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { DropdownMenu } from "../../components/ui/Menu";
import { useToast } from "../../components/ui/Toast";

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function LocationsPage() {
  const context = useManagerContext();
  const toast = useToast();
  const manage = canManage(context.role);

  const [locations, setLocations] = useState<Locations.Location[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);

  const [renameTarget, setRenameTarget] = useState<Locations.Location | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const refresh = useCallback(() => {
    setError(null);
    return Locations.listLocations(context.workspace.id).then(setLocations).catch(setError);
  }, [context.workspace.id]);

  useEffect(() => {
    setLocations(null);
    void refresh();
  }, [refresh]);

  function openCreate() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await Locations.createLocation(context.workspace.id, { name: name.trim(), slug });
      toast.show("Location created", "success");
      setCreateOpen(false);
      await refresh();
    } catch (err) {
      setCreateError(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim() || renameValue.trim() === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    try {
      await Locations.updateLocation(context.workspace.id, renameTarget.id, { name: renameValue.trim() });
      toast.show("Location renamed", "success");
      setRenameTarget(null);
      await refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't rename location.", "danger");
    } finally {
      setRenaming(false);
    }
  }

  async function handleToggleActive(location: Locations.Location) {
    const activating = location.status !== "active";
    try {
      await Locations.setLocationActive(context.workspace.id, location.id, activating);
      toast.show(activating ? "Location activated" : "Location deactivated", "success");
      await refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update location.", "danger");
    }
  }

  return (
    <div className="scena-page">
      <PageHeader
        title="Locations"
        description="Physical sites that Displays and Sessions are scoped to."
        actions={manage ? <Button variant="primary" icon={<Plus size={18} />} onClick={openCreate}>New Location</Button> : undefined}
      />

      {error ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : !locations ? (
        <div style={{ display: "grid", gap: 12 }}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></div>
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<MapPin size={32} />}
          title="No Locations yet"
          description="Create your first location — Displays and Sessions are organized under it."
          action={manage && <Button variant="primary" size="sm" onClick={openCreate}>New Location</Button>}
        />
      ) : (
        <div className="scena-table-wrap">
          <table className="scena-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Timezone</th><th>Status</th>{manage && <th />}</tr></thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td style={{ fontWeight: 600 }}>{location.name}</td>
                  <td style={{ fontFamily: "var(--scena-font-mono)", fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>{location.slug}</td>
                  <td>{location.timezone}</td>
                  <td><StatusIndicator status={location.status} /></td>
                  {manage && (
                    <td style={{ width: 40 }}>
                      <DropdownMenu
                        trigger={<IconButton icon={<PencilSimple size={18} />} label="Location actions" size="sm" />}
                        items={[
                          { key: "rename", icon: <PencilSimple size={16} />, label: "Rename", onSelect: () => { setRenameTarget(location); setRenameValue(location.name); } },
                          {
                            key: "toggle",
                            icon: <Power size={16} />,
                            label: location.status === "active" ? "Deactivate" : "Activate",
                            danger: location.status === "active",
                            onSelect: () => void handleToggleActive(location),
                          },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <Modal open title="New Location" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 16 }}>
            {createError != null && <ErrorBanner error={createError} />}
            <Field label="Name">
              <Input
                value={name}
                maxLength={120}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugTouched) setSlug(slugify(event.target.value));
                }}
                placeholder="Front of House"
              />
            </Field>
            <Field label="Slug" hint="Lowercase identifier used in URLs and pairing.">
              <Input
                value={slug}
                maxLength={60}
                onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }}
                placeholder="front-of-house"
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={creating} disabled={!name.trim() || !slug}>Create Location</Button>
            </div>
          </form>
        </Modal>
      )}

      {renameTarget && (
        <Modal open title={`Rename "${renameTarget.name}"`} onClose={() => setRenameTarget(null)}>
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Name">
              <Input value={renameValue} maxLength={120} autoFocus onChange={(event) => setRenameValue(event.target.value)} />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
              <Button variant="primary" loading={renaming} disabled={!renameValue.trim()} onClick={() => void handleRename()}>Rename</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
