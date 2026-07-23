import { Link } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";

export function PlanSettingsPage() {
  const context = useManagerContext();
  const entitlements = context.workspace.entitlements;

  return (
    <div className="scena-page scena-container-narrow">
      <PageHeader title="Plan" description="Real-time entitlements for this Workspace." actions={<Link to="/app/billing"><Button variant="primary" size="sm">Manage billing</Button></Link>} />

      {!entitlements ? (
        <Skeleton height={160} />
      ) : (
        <Card>
          <div style={{ fontFamily: "var(--scena-font-display)", fontSize: "var(--scena-text-xl)", marginBottom: 16, textTransform: "capitalize" }}>
            {entitlements.plan_code}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, fontSize: "var(--scena-text-sm)" }}>
            <Stat label="Displays" value={entitlements.max_displays} />
            <Stat label="Boards" value={entitlements.max_boards} />
            <Stat label="Members" value={entitlements.max_members} />
            <Stat label="Concurrent Sessions" value={entitlements.max_concurrent_sessions} />
            <Stat label="Displays per Session" value={entitlements.max_displays_per_session} />
            <Stat label="Automation tier" value={entitlements.automation_tier} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ color: "var(--scena-text-muted)", fontSize: "var(--scena-text-xs)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
