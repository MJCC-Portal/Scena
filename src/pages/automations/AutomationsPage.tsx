import { useEffect, useMemo, useState } from "react";
import { Lightning, PencilSimple, Plus } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Automations from "../../domain/automations";
import * as Layouts from "../../domain/layouts";
import * as Locations from "../../domain/locations";
import * as Sessions from "../../domain/sessions";
import { DISPLAY_MODE_VALUES } from "../../shared/validation";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusIndicator } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const ACTION_OPTIONS: Array<{ value: Automations.ActionType; label: string }> = [
  { value: "start_session", label: "Start Session" },
  { value: "stop_session", label: "Stop Session" },
  { value: "set_display_mode", label: "Set display mode" },
  { value: "set_shared_layout", label: "Set shared Layout" },
  { value: "set_screen_layout", label: "Set Screen Layout" },
  { value: "enable_screen", label: "Enable Screen" },
  { value: "disable_screen", label: "Disable Screen" },
  { value: "switch_primary_screen", label: "Switch primary Screen" },
];

const SCREEN_TARGET_ACTIONS: Automations.ActionType[] = ["set_screen_layout", "enable_screen", "disable_screen", "switch_primary_screen"];

function screenLabel(screen: Sessions.SessionScreen): string {
  return `Screen ${screen.screen_order + 1}${screen.is_primary ? " (primary)" : ""}`;
}

export function AutomationsPage() {
  const context = useManagerContext();
  const toast = useToast();
  const manage = canManage(context.role);
  const [automations, setAutomations] = useState<Automations.Automation[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Automations.Automation | null>(null);
  const [disabling, setDisabling] = useState<Automations.Automation | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  function load() {
    setError(null);
    Automations.listAutomations(context.workspace.id).then(setAutomations).catch(setError);
  }
  useEffect(load, [context.workspace.id]);

  async function enable(automation: Automations.Automation) {
    setRowBusyId(automation.id);
    try {
      await Automations.updateAutomation(context.workspace.id, automation.id, { is_enabled: true });
      toast.show("Automation enabled.", "success");
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't enable Automation.", "danger");
    } finally {
      setRowBusyId(null);
    }
  }

  async function confirmDisable() {
    if (!disabling) return;
    setRowBusyId(disabling.id);
    try {
      await Automations.disableAutomation(context.workspace.id, disabling.id);
      toast.show("Automation disabled.", "success");
      setDisabling(null);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't disable Automation.", "danger");
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <div className="scena-page">
      <PageHeader
        title="Automations"
        description="Scheduled Session and Display actions — run once or on a cron schedule."
        actions={manage ? (
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
            New automation
          </Button>
        ) : undefined}
      />

      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !automations ? (
        <div style={{ display: "grid", gap: 12 }}><Skeleton height={56} /><Skeleton height={56} /></div>
      ) : automations.length === 0 ? (
        <EmptyState
          icon={<Lightning size={32} />}
          title="No Automations yet"
          description={manage ? "Create an Automation to schedule Session and Display actions." : "Automations will appear here once created."}
          action={manage ? <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>New automation</Button> : undefined}
        />
      ) : (
        <div className="scena-table-wrap">
          <table className="scena-table">
            <caption className="scena-visually-hidden">Automations</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Action</th>
                <th scope="col">Schedule</th>
                <th scope="col">Status</th>
                {manage && <th scope="col" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {automations.map((automation) => (
                <tr key={automation.id}>
                  <td>{automation.name}</td>
                  <td style={{ textTransform: "capitalize" }}>{automation.action_type.replace(/_/g, " ")}</td>
                  <td>
                    {automation.schedule_type === "cron"
                      ? `${automation.cron_expression} (${automation.timezone})`
                      : automation.run_once_at
                        ? `Once — ${new Date(automation.run_once_at).toLocaleString()}`
                        : "One-time"}
                  </td>
                  <td><StatusIndicator status={automation.is_enabled ? "active" : "stopped"} label={automation.is_enabled ? "Enabled" : "Disabled"} /></td>
                  {manage && (
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<PencilSimple size={16} />}
                          onClick={() => setRenaming(automation)}
                        >
                          Rename
                        </Button>
                        {automation.is_enabled ? (
                          <Button variant="danger" size="sm" loading={rowBusyId === automation.id} onClick={() => setDisabling(automation)}>
                            Disable
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" loading={rowBusyId === automation.id} onClick={() => enable(automation)}>
                            Enable
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateAutomationModal
          orgId={context.workspace.id}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            toast.show("Automation created.", "success");
            load();
          }}
        />
      )}

      {renaming && (
        <RenameAutomationModal
          orgId={context.workspace.id}
          automation={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={() => {
            setRenaming(null);
            toast.show("Automation renamed.", "success");
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!disabling}
        title="Disable Automation?"
        description={disabling ? `"${disabling.name}" will stop running until it is enabled again.` : undefined}
        confirmLabel="Disable"
        danger
        loading={!!disabling && rowBusyId === disabling.id}
        onConfirm={confirmDisable}
        onCancel={() => setDisabling(null)}
      />
    </div>
  );
}

function CreateAutomationModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [sessions, setSessions] = useState<Sessions.DisplaySession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [screens, setScreens] = useState<Sessions.SessionScreen[]>([]);
  const [layouts, setLayouts] = useState<Layouts.Layout[]>([]);
  const [name, setName] = useState("");
  const [actionType, setActionType] = useState<Automations.ActionType>("start_session");
  const [screenId, setScreenId] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [displayMode, setDisplayMode] = useState("");
  const [scheduleType, setScheduleType] = useState<"once" | "cron">("once");
  const [runOnceAt, setRunOnceAt] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Locations.listLocations(orgId).then((rows) => {
      setLocations(rows);
      setLocationId((current) => current || (rows.length ? rows[0].id : ""));
    }).catch(setError);
  }, [orgId]);

  useEffect(() => {
    setSessionId("");
    setSessions([]);
    setLayouts([]);
    if (!locationId) return;
    Sessions.listSessions(orgId, locationId).then(setSessions).catch(setError);
    Layouts.listLayouts(orgId, locationId).then(setLayouts).catch(setError);
  }, [orgId, locationId]);

  useEffect(() => {
    setScreenId("");
    setScreens([]);
    if (!sessionId) return;
    Sessions.getSession(orgId, sessionId).then((session) => setScreens(session?.screens ?? [])).catch(setError);
  }, [orgId, sessionId]);

  const needsScreen = SCREEN_TARGET_ACTIONS.includes(actionType);
  const needsLayout =
    actionType === "set_shared_layout" ||
    actionType === "set_screen_layout" ||
    (actionType === "set_display_mode" && (displayMode === "duplicate" || displayMode === "extend"));

  const valid = useMemo(() => {
    if (!name.trim() || !locationId || !sessionId) return false;
    if (needsScreen && !screenId) return false;
    if (needsLayout && !layoutId) return false;
    if (actionType === "set_display_mode" && !displayMode) return false;
    if (scheduleType === "once" && (!runOnceAt || Number.isNaN(Date.parse(runOnceAt)))) return false;
    if (scheduleType === "cron" && !cronExpression.trim()) return false;
    return true;
  }, [name, locationId, sessionId, needsScreen, screenId, needsLayout, layoutId, actionType, displayMode, scheduleType, runOnceAt, cronExpression]);

  async function create() {
    setError(null);
    setSubmitting(true);
    try {
      await Automations.createAutomation(orgId, locationId, {
        name: name.trim(),
        session_id: sessionId,
        action_type: actionType,
        target_session_screen_id: needsScreen ? screenId : null,
        target_layout_id: needsLayout ? layoutId : null,
        target_display_mode: actionType === "set_display_mode" ? displayMode : null,
        schedule:
          scheduleType === "once"
            ? { schedule_type: "once", run_once_at: new Date(runOnceAt).toISOString(), timezone }
            : { schedule_type: "cron", cron_expression: cronExpression.trim(), timezone },
      });
      onCreated();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New automation"
      description="Schedule a Session or Display action to run once or on a cron schedule."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={submitting} onClick={create}>Create automation</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner error={error} /> : null}
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Morning start" maxLength={120} />
        </Field>
        <Field label="Location">
          <Select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
          />
        </Field>
        <Field label="Session" hint={locationId && sessions.length === 0 ? "No Sessions at this location yet." : undefined}>
          <Select
            value={sessionId}
            disabled={!locationId}
            onChange={(event) => setSessionId(event.target.value)}
            options={[{ value: "", label: "Select a Session" }, ...sessions.map((session) => ({ value: session.id, label: session.name }))]}
          />
        </Field>
        <Field label="Action">
          <Select
            value={actionType}
            onChange={(event) => setActionType(event.target.value as Automations.ActionType)}
            options={ACTION_OPTIONS}
          />
        </Field>
        {needsScreen && (
          <Field label="Target Screen" hint={sessionId && screens.length === 0 ? "This Session has no Screens assigned yet." : undefined}>
            <Select
              value={screenId}
              disabled={!sessionId}
              onChange={(event) => setScreenId(event.target.value)}
              options={[{ value: "", label: "Select a Screen" }, ...screens.map((screen) => ({ value: screen.id, label: screenLabel(screen) }))]}
            />
          </Field>
        )}
        {actionType === "set_display_mode" && (
          <Field label="Display mode">
            <Select
              value={displayMode}
              onChange={(event) => setDisplayMode(event.target.value)}
              options={[{ value: "", label: "Select a mode" }, ...DISPLAY_MODE_VALUES.map((mode) => ({ value: mode, label: mode }))]}
            />
          </Field>
        )}
        {needsLayout && (
          <Field label="Layout" hint={locationId && layouts.length === 0 ? "No Layouts at this location yet." : undefined}>
            <Select
              value={layoutId}
              disabled={!locationId}
              onChange={(event) => setLayoutId(event.target.value)}
              options={[{ value: "", label: "Select a Layout" }, ...layouts.map((layout) => ({ value: layout.id, label: layout.name }))]}
            />
          </Field>
        )}
        <Field label="Schedule">
          <Select
            value={scheduleType}
            onChange={(event) => setScheduleType(event.target.value as "once" | "cron")}
            options={[{ value: "once", label: "Run once" }, { value: "cron", label: "Cron schedule" }]}
          />
        </Field>
        {scheduleType === "once" ? (
          <Field label="Run at">
            <Input type="datetime-local" value={runOnceAt} onChange={(event) => setRunOnceAt(event.target.value)} />
          </Field>
        ) : (
          <Field label="Cron expression" hint="Standard 5-field cron, e.g. 0 8 * * 1-5 for weekdays at 08:00.">
            <Input value={cronExpression} onChange={(event) => setCronExpression(event.target.value)} placeholder="0 8 * * 1-5" maxLength={120} />
          </Field>
        )}
        <Field label="Timezone" hint="IANA timezone name.">
          <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" maxLength={64} />
        </Field>
      </div>
    </Modal>
  );
}

function RenameAutomationModal({ orgId, automation, onClose, onRenamed }: {
  orgId: string;
  automation: Automations.Automation;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(automation.name);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setError(null);
    setSubmitting(true);
    try {
      await Automations.updateAutomation(orgId, automation.id, { name: name.trim() });
      onRenamed();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Rename Automation"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} loading={submitting} onClick={save}>Save</Button>
        </>
      }
    >
      {error ? <ErrorBanner error={error} /> : null}
      <Field label="Name">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
      </Field>
    </Modal>
  );
}
