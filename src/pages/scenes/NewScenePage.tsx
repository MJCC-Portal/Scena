// Menu-type scene creation only, matching the pre-router harness
// (src/App.tsx's ScenesPanel never wired presentation-scene creation
// either — see docs/api-inventory.json).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Locations from "../../domain/locations";
import * as Menus from "../../domain/menus";
import * as Scenes from "../../domain/scenes";

export function NewScenePage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [menus, setMenus] = useState<Menus.Menu[]>([]);
  const [menuId, setMenuId] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  useEffect(() => {
    if (locationId) Menus.listMenus(context.organization.id, locationId).then(setMenus);
  }, [context.organization.id, locationId]);

  async function create() {
    setErr("");
    try {
      await Scenes.createMenuScene(context.organization.id, locationId, name, menuId);
      navigate("/app/scenes");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <section>
      <div className="view-head"><h1>New scene</h1></div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
        <option value="">— select a menu —</option>
        {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn gold" disabled={!locationId || !menuId || !name} onClick={create}>Create</button>
      {err && <div className="error">{err}</div>}
    </section>
  );
}
