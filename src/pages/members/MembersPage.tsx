// Workspace member management. There is no invite-by-email API in
// src/domain/organizations.ts (team_invitations exists in the schema but no
// client function calls it yet) — so this page manages members that already
// have a row (role change, remove), and does not show a fake "invite"
// button that would silently do nothing.
import { useEffect, useState } from "react";
import { UsersThree, Trash } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage, isAdmin } from "../../auth/organization-context";
import * as Organizations from "../../domain/organizations";
import { ROLE_VALUES } from "../../shared/validation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusIndicator } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { IconButton } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";

export function MembersPage() {
  const context = useManagerContext();
  const toast = useToast();
  const canManageRoles = isAdmin(context.role) && canManage(context.role);
  const [members, setMembers] = useState<Organizations.Member[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [removeTarget, setRemoveTarget] = useState<Organizations.Member | null>(null);
  const [removing, setRemoving] = useState(false);

  function load() {
    setError(null);
    Organizations.listMembers(context.workspace.id).then(setMembers).catch(setError);
  }
  useEffect(load, [context.workspace.id]);

  async function handleRoleChange(member: Organizations.Member, role: string) {
    try {
      await Organizations.upsertMember(context.workspace.id, member.user_id, role);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update role.", "danger");
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await Organizations.removeMember(context.workspace.id, removeTarget.user_id);
      toast.show("Member removed", "success");
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't remove member.", "danger");
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  const isSinglePersonalWorkspace = context.workspace.type === "personal";

  return (
    <div className="scena-page">
      <PageHeader
        title="Members"
        description={isSinglePersonalWorkspace ? "Personal Workspaces support a single member." : "People with access to this Workspace."}
      />

      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !members ? (
        <div style={{ display: "grid", gap: 12 }}><Skeleton height={56} /></div>
      ) : members.length === 0 ? (
        <EmptyState icon={<UsersThree size={32} />} title="No members found" />
      ) : (
        <div className="scena-table-wrap">
          <table className="scena-table">
            <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th>{canManageRoles && <th />}</tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id}>
                  <td style={{ fontFamily: "var(--scena-font-mono)", fontSize: "var(--scena-text-xs)" }}>{member.user_id}</td>
                  <td>
                    {canManageRoles && member.role !== "owner" ? (
                      <Select
                        value={member.role}
                        onChange={(event) => handleRoleChange(member, event.target.value)}
                        options={ROLE_VALUES.filter((role) => role !== "owner").map((role) => ({ value: role, label: capitalize(role) }))}
                        style={{ maxWidth: 140 }}
                      />
                    ) : (
                      capitalize(member.role)
                    )}
                  </td>
                  <td><StatusIndicator status={member.status} /></td>
                  <td>{new Date(member.created_at).toLocaleDateString()}</td>
                  {canManageRoles && (
                    <td style={{ width: 40 }}>
                      {member.role !== "owner" && (
                        <IconButton icon={<Trash size={16} />} label="Remove member" size="sm" onClick={() => setRemoveTarget(member)} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove this member?"
        description="They'll immediately lose access to this Workspace."
        confirmLabel="Remove"
        danger
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
