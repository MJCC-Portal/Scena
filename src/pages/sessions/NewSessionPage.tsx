import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Locations from "../../domain/locations";
import * as Sessions from "../../domain/sessions";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

export function NewSessionPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
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

  async function create() {
    setError(null);
    setSubmitting(true);
    try {
      await Sessions.createDraftSession(context.workspace.id, locationId, name);
      navigate("/app/sessions");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="scena-page scena-container-narrow">
      <PageHeader title="New Session" description="Draft Sessions start stopped — you can start them once Displays are assigned." />
      <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {error ? <ErrorBanner error={error} /> : null}
        <Field label="Location">
          <Select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
          />
        </Field>
        <Field label="Session name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Evening rotation" />
        </Field>
        <Button variant="primary" block disabled={!locationId || !name} loading={submitting} onClick={create}>
          Create draft
        </Button>
      </Card>
    </div>
  );
}
