// /app/locations — real data, moved unchanged from src/App.tsx's
// LocationsPanel (pre-router harness). Logic preserved; only the wrapper
// changed (route instead of a tab).

import { useEffect, useState } from "react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Locations from "../../domain/locations";
import { Json } from "../shared/Json";

export function LocationsPage() {
  const context = useManagerContext();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");

  const refresh = () => Locations.listLocations(context.organization.id).then(setLocations);
  useEffect(() => { refresh(); }, [context.organization.id]);

  async function create() {
    setErr("");
    try {
      await Locations.createLocation(context.organization.id, { name, slug });
      setName(""); setSlug("");
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <section>
      <div className="view-head"><h1>Locations</h1></div>
      {manage && <div style={{ marginBottom: 8 }}>
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <button onClick={create}>Create</button>
        {err && <span style={{ color: "red" }}> {err}</span>}
      </div>}
      <Json value={locations} />
    </section>
  );
}
