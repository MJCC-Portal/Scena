import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Broadcast, Plus, Play, Stop } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import * as Sessions from "../../domain/sessions";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Button } from "../../components/ui/Button";
import { StatusIndicator } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { Card } from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";

export function SessionsPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [sessions, setSessions] = useState<Sessions.DisplaySession[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    Locations.listLocations(context.workspace.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspace.id]);

  function refresh() {
    if (!locationId) return;
    setError(null);
    Sessions.listSessions(context.workspace.id, locationId).then(setSessions).catch(setError);
  }
  useEffect(refresh, [context.workspace.id, locationId]);

  async function toggle(session: Sessions.DisplaySession) {
    try {
      if (session.status === "draft") await Sessions.startSession(context.workspace.id, session.id, context.userId);
      else if (session.status === "active") await Sessions.stopSession(context.workspace.id, session.id, context.userId);
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update Session.", "danger");
    }
  }

  return (
    <div className="scena-page">
      <PageHeader
        title="Sessions"
        description="Run content across the Displays at a location."
        actions={manage ? <Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate("/app/sessions/new")}>New Session</Button> : undefined}
      />

      <div className="scena-filter-bar">
        <Select
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
          style={{ maxWidth: 240 }}
        />
      </div>

      {!locationId ? (
        <EmptyState icon={<Broadcast size={32} />} title="Choose a location" description="Select a location above to see its Sessions." />
      ) : error ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : !sessions ? (
        <div style={{ display: "grid", gap: 12 }}><Skeleton height={64} /><Skeleton height={64} /></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={<Broadcast size={32} />} title="No Sessions yet" description="Create a Session to start playing content on this location's Displays." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sessions.map((session) => (
            <Card key={session.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Link to={`/app/sessions/${session.id}`} style={{ fontWeight: 600 }}>{session.name}</Link>
                <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>{session.display_mode}</div>
              </div>
              <StatusIndicator status={session.status} />
              {manage && session.status === "draft" && (
                <Button variant="secondary" size="sm" icon={<Play size={16} />} onClick={() => toggle(session)}>Start</Button>
              )}
              {manage && session.status === "active" && (
                <Button variant="danger" size="sm" icon={<Stop size={16} />} onClick={() => toggle(session)}>Stop</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
