import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Screens from "../../domain/screens";
import { Json } from "../shared/Json";

export function ScreensPage() {
  const context = useManagerContext();
  const manage = canManage(context.role);
  const [screens, setScreens] = useState<Screens.Screen[]>([]);

  useEffect(() => { Screens.listScreens(context.organization.id).then(setScreens); }, [context.organization.id]);

  return (
    <section>
      <div className="view-head">
        <h1>Screens</h1>
        {manage && <Link className="btn gold" to="/app/screens/pair">Pair a screen</Link>}
      </div>
      <Json value={screens} />
    </section>
  );
}
