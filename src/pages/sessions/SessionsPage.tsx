import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import * as Sessions from "../../domain/sessions";
import { Json } from "../shared/Json";

export function SessionsPage() {
  const context = useManagerContext();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [sessions, setSessions] = useState<Sessions.DisplaySession[]>([]);

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  const refresh = () => { if (locationId) Sessions.listSessions(context.organization.id, locationId).then(setSessions); };
  useEffect(refresh, [context.organization.id, locationId]);

  return (
    <section>
      <div className="view-head">
        <h1>Sessions</h1>
        {manage && <Link className="btn gold" to="/app/sessions/new">New session</Link>}
      </div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {locationId && sessions.map((s) => (
        <div key={s.id} style={{ marginBottom: 8, borderBottom: "1px solid #333", paddingBottom: 8 }}>
          <b>{s.name}</b> — {s.status} — {s.display_mode}
          {manage && s.status === "draft" && <button onClick={() => Sessions.startSession(context.organization.id, s.id, context.userId).then(refresh)}>Start</button>}
          {manage && s.status === "active" && <button onClick={() => Sessions.stopSession(context.organization.id, s.id, context.userId).then(refresh)}>Stop</button>}
        </div>
      ))}
      {locationId && <Json value={sessions} />}
    </section>
  );
}
