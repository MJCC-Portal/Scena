import { useEffect, useState } from "react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Orgs from "../../domain/organizations";
import { Json } from "../shared/Json";

export function PlanSettingsPage() {
  const context = useManagerContext();
  const [entitlement, setEntitlement] = useState<Orgs.Entitlement | null>(null);
  useEffect(() => { Orgs.getEntitlement(context.organization.id).then(setEntitlement); }, [context.organization.id]);
  return (
    <section>
      <div className="view-head"><h1>Plan</h1></div>
      <Json value={entitlement} />
    </section>
  );
}
