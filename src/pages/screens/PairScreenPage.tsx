// /app/screens/pair — real claim flow, extracted from src/App.tsx's
// ScreensPanel inline form. Calls screen-claim, the same Edge Function,
// unchanged.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { callEdgeFunction } from "../../services/supabase/client";
import * as Locations from "../../domain/locations";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

export function PairScreenPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Locations.listLocations(context.workspace.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    }).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspace.id]);

  async function claim() {
    setError(null);
    setSubmitting(true);
    try {
      await callEdgeFunction("screen-claim", { code, name, location_id: locationId });
      navigate("/app/screens");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="scena-page scena-container-narrow">
      <PageHeader title="Pair a Display" description="Enter the six-digit code shown on the screen." />

      <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {error ? <ErrorBanner error={error} /> : null}

        <Field label="Location">
          <Select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
          />
        </Field>

        <Field label="Pairing code" hint="The six-digit code shown on the Display.">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            placeholder="123456"
            style={{ fontFamily: "var(--scena-font-mono)", fontSize: "var(--scena-text-xl)", letterSpacing: "0.3em", textAlign: "center" }}
          />
        </Field>

        <Field label="Display name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Front Counter" />
        </Field>

        <Button
          variant="primary"
          block
          icon={<Monitor size={18} />}
          disabled={!locationId || code.length !== 6 || !name}
          loading={submitting}
          onClick={claim}
        >
          Pair Display
        </Button>
      </Card>
    </div>
  );
}
