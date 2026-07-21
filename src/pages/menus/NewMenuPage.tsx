// /app/menus/new — real create form, extracted from the inline form that
// used to live in src/App.tsx's MenusPanel.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Locations from "../../domain/locations";
import * as Menus from "../../domain/menus";

export function NewMenuPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  async function create() {
    setErr("");
    try {
      await Menus.createMenu(context.organization.id, locationId, name);
      navigate("/app/menus");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <section>
      <div className="view-head"><h1>New menu</h1></div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn gold" disabled={!locationId || !name} onClick={create}>Create</button>
      {err && <div className="error">{err}</div>}
    </section>
  );
}
