import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import * as Scenes from "../../domain/scenes";
import { Json } from "../shared/Json";

export function ScenesPage() {
  const context = useManagerContext();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [scenes, setScenes] = useState<Scenes.Scene[]>([]);

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  useEffect(() => {
    if (locationId) Scenes.listScenes(context.organization.id, locationId).then(setScenes);
  }, [context.organization.id, locationId]);

  return (
    <section>
      <div className="view-head">
        <h1>Scenes</h1>
        {manage && <Link className="btn gold" to="/app/scenes/new">New scene</Link>}
      </div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {!locationId ? <p className="muted">Select a location.</p> : <Json value={scenes} />}
    </section>
  );
}
