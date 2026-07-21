// /app/menus — real data, moved from src/App.tsx's MenusPanel. Location
// selection is local to this page (the pre-router shell had a single
// global location selector; the target route map has no location segment
// in these paths, so each content page now picks its own location).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import * as Menus from "../../domain/menus";
import { Json } from "../shared/Json";

export function MenusPage() {
  const context = useManagerContext();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [menus, setMenus] = useState<Menus.Menu[]>([]);

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  useEffect(() => {
    if (locationId) Menus.listMenus(context.organization.id, locationId).then(setMenus);
  }, [context.organization.id, locationId]);

  return (
    <section>
      <div className="view-head">
        <h1>Menus</h1>
        {manage && <Link className="btn gold" to="/app/menus/new">New menu</Link>}
      </div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {!locationId ? <p className="muted">Select a location.</p> : <Json value={menus} />}
    </section>
  );
}
