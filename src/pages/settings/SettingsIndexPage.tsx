// Settings hub. Profile fields are read-only — there is no update-profile
// API in this codebase yet, so no edit form is shown for fields the backend
// can't persist.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Buildings, CreditCard } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { supabase } from "../../services/supabase/client";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";

export function SettingsIndexPage() {
  const context = useManagerContext();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase?.auth.getSession().then(({ data }) => {
      if (active) setEmail(data.session?.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="scena-page scena-container-narrow">
      <PageHeader title="Settings" description="Your profile and Workspace preferences." />

      <Card style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <Avatar name={context.profile.displayName || email || "?"} src={context.profile.avatarUrl} size="lg" />
        <div>
          <div style={{ fontWeight: 600, fontSize: "var(--scena-text-lg)" }}>{context.profile.displayName || "Unnamed"}</div>
          {email && <div style={{ color: "var(--scena-text-muted)", fontSize: "var(--scena-text-sm)" }}>{email}</div>}
          <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)", marginTop: 4 }}>{context.profile.timezone}</div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Link to="/app/settings/organization">
          <Card interactive style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Buildings size={24} style={{ color: "var(--scena-violet)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--scena-text-sm)" }}>Organization</div>
              <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>Workspace details</div>
            </div>
          </Card>
        </Link>
        <Link to="/app/settings/plan">
          <Card interactive style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CreditCard size={24} style={{ color: "var(--scena-violet)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--scena-text-sm)" }}>Plan</div>
              <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>Entitlements and limits</div>
            </div>
          </Card>
        </Link>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link to="/app/billing"><Button variant="secondary" icon={<CreditCard size={18} />}>Go to Billing</Button></Link>
      </div>
    </div>
  );
}
