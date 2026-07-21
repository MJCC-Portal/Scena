// /app/screens/pair — real claim flow, extracted from src/App.tsx's
// ScreensPanel inline form. Calls screen-claim, the same Edge Function,
// unchanged.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { callEdgeFunction } from "../../services/supabase/client";
import * as Locations from "../../domain/locations";

export function PairScreenPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Locations.listLocations(context.organization.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    });
  }, [context.organization.id]);

  async function claim() {
    setErr("");
    try {
      await callEdgeFunction("screen-claim", { code, name, location_id: locationId });
      navigate("/app/screens");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <section>
      <div className="view-head"><h1>Pair a screen</h1></div>
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
        <option value="">— select a location —</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
      <input placeholder="screen name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn gold" disabled={!locationId || code.length !== 6 || !name} onClick={claim}>Claim</button>
      {err && <div className="error">{err}</div>}
    </section>
  );
}
