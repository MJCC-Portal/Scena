// Billing. Important real constraint: there is no "upgrade this Workspace's
// plan in place" API — startWorkspaceCheckout (billing-checkout) always
// creates a NEW Workspace (an additional Personal Workspace, or a new Team
// Workspace). So this page shows the current Workspace's real plan/limits,
// a "Manage billing" link to the Stripe portal for Workspaces that already
// have a billing customer, and a genuinely separate "create a paid
// Workspace" flow — not a misleading in-place "Upgrade" button.
import { useState } from "react";
import { CreditCard, Check } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Billing from "../../domain/billing";
import { callEdgeFunction } from "../../services/supabase/client";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

const OFFERING_LABELS: Record<Billing.CheckoutOfferingCode, string> = {
  personal_additional: "Additional Personal Workspace — $15 one-time",
  plus: "Plus Team Workspace — $15/month",
  pro: "Pro Team Workspace — $25/month",
  max: "Max Team Workspace — $40/month",
};

export function BillingPage() {
  const context = useManagerContext();
  const entitlements = context.workspace.entitlements;
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<unknown>(null);
  const [checkoutOffering, setCheckoutOffering] = useState<Billing.CheckoutOfferingCode | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [checkoutError, setCheckoutError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const result = await callEdgeFunction<{ portal_url: string }>("billing-portal", {});
      window.location.assign(result.portal_url);
    } catch (err) {
      setPortalError(err);
      setPortalLoading(false);
    }
  }

  async function submitCheckout() {
    if (!checkoutOffering) return;
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const result = await Billing.startWorkspaceCheckout({ offering_code: checkoutOffering, workspace_name: workspaceName });
      window.location.assign(result.checkout_url);
    } catch (err) {
      setCheckoutError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="scena-page">
      <PageHeader title="Billing" description="Your Workspace's plan and payment management." />

      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)", marginBottom: 8 }}>
          Current plan — {context.workspace.name}
        </div>
        <div style={{ fontFamily: "var(--scena-font-display)", fontSize: "var(--scena-text-2xl)", marginBottom: 12, textTransform: "capitalize" }}>
          {entitlements?.plan_code ?? (context.workspace.type === "personal" ? "Personal Free" : "—")}
        </div>
        {entitlements && (
          <ul style={{ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)" }}>
            <li>{entitlements.max_displays} Displays</li>
            <li>{entitlements.max_boards} Boards</li>
            <li>{entitlements.max_members} members</li>
            <li>{entitlements.max_concurrent_sessions} concurrent Session(s)</li>
          </ul>
        )}
        {portalError ? <div style={{ marginTop: 16 }}><ErrorBanner error={portalError} /></div> : null}
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" icon={<CreditCard size={18} />} loading={portalLoading} onClick={openPortal}>
            Manage billing
          </Button>
        </div>
      </Card>

      <PageHeader title="Add a paid Workspace" description="Each Workspace is billed separately — this creates a new one, it doesn't change your current Workspace's plan." />
      <div className="scena-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {(Object.keys(OFFERING_LABELS) as Billing.CheckoutOfferingCode[]).map((code) => (
          <Card key={code}>
            <div style={{ fontSize: "var(--scena-text-sm)", marginBottom: 16 }}>{OFFERING_LABELS[code]}</div>
            <Button variant="primary" size="sm" block onClick={() => setCheckoutOffering(code)}>Get started</Button>
          </Card>
        ))}
      </div>

      <Modal
        open={!!checkoutOffering}
        onClose={() => setCheckoutOffering(null)}
        title="Name your new Workspace"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckoutOffering(null)}>Cancel</Button>
            <Button variant="primary" loading={submitting} disabled={!workspaceName.trim()} onClick={submitCheckout} icon={<Check size={18} />}>
              Continue to checkout
            </Button>
          </>
        }
      >
        {checkoutError ? <div style={{ marginBottom: 16 }}><ErrorBanner error={checkoutError} /></div> : null}
        <Field label="Workspace name">
          <Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Acme Diner" />
        </Field>
      </Modal>
    </div>
  );
}
