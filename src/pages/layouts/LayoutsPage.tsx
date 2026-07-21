import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import * as Layouts from "../../domain/layouts";
import { Json } from "../shared/Json";

export function LayoutsPage() {
  const context = useManagerContext();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [layouts, setLayouts] = useState<Layouts.Layout[]>([]);

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  useEffect(() => {
    if (locationId) Layouts.listLayouts(context.organization.id, locationId).then(setLayouts);
  }, [context.organization.id, locationId]);

  return (
    <section>
      <div className="view-head">
        <h1>Layouts</h1>
        {manage && <Link className="btn gold" to="/app/layouts/new">New layout</Link>}
      </div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {!locationId ? <p className="muted">Select a location.</p> : <Json value={layouts} />}
    </section>
  );
}
