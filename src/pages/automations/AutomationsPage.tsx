import { useEffect, useState } from "react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Automations from "../../domain/automations";
import { Json } from "../shared/Json";

export function AutomationsPage() {
  const context = useManagerContext();
  const [automations, setAutomations] = useState<Automations.Automation[]>([]);
  useEffect(() => { Automations.listAutomations(context.organization.id).then(setAutomations); }, [context.organization.id]);
  return (
    <section>
      <div className="view-head"><h1>Automations</h1></div>
      <p className="muted">Read-only — create/edit/disable UI is not built yet (services exist in src/domain/automations.ts).</p>
      <Json value={automations} />
    </section>
  );
}
