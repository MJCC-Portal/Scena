// Account and Workspace context boundary. Scena supports multiple Personal and
// Team Workspaces. The selected Workspace is explicit and is persisted by the
// workspace-context Edge Function through user_preferences.last_org_id.

import type { Role } from "../shared/validation";
import {
  getWorkspaceContext,
  selectWorkspace,
  toWorkspaceAccountProfile,
  type AuthorizedWorkspace,
  type WorkspaceAccountProfile,
} from "../services/scena-api/workspaces";

export interface ManagerOrganization {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
}

export interface ManagerContext {
  userId: string;
  profile: WorkspaceAccountProfile;
  workspace: AuthorizedWorkspace;
  workspaces: AuthorizedWorkspace[];
  organization: ManagerOrganization;
  role: Role;
}

export interface AccountContext {
  userId: string;
  profile: WorkspaceAccountProfile;
  workspaces: AuthorizedWorkspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: AuthorizedWorkspace | null;
}

export async function loadAccountContext(): Promise<AccountContext> {
  return fromWorkspaceResponse(await getWorkspaceContext());
}

export async function switchAccountWorkspace(
  workspaceId: string,
): Promise<AccountContext> {
  return fromWorkspaceResponse(await selectWorkspace(workspaceId));
}

export function toManagerContext(account: AccountContext): ManagerContext | null {
  // The fallback keeps pre-v1.0.15 route tests and a hot-reloaded legacy
  // account object from crashing during the migration. New context responses
  // never populate `team`; they always use selectedWorkspace/workspaces.
  const legacyWorkspace = (
    account as AccountContext & { team?: AuthorizedWorkspace | null }
  ).team;
  const workspace = account.selectedWorkspace ?? legacyWorkspace ?? null;
  if (!workspace) return null;

  const workspaces = account.workspaces?.length
    ? account.workspaces
    : [workspace];

  return {
    userId: account.userId,
    profile: account.profile,
    workspace,
    workspaces,
    organization: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
    },
    role: workspace.role,
  };
}

export function canManage(role: Role): boolean {
  return role !== "viewer";
}

export function isAdmin(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: Role): boolean {
  return role === "owner";
}

function fromWorkspaceResponse(
  response: Awaited<ReturnType<typeof getWorkspaceContext>>,
): AccountContext {
  return {
    userId: response.user_id,
    profile: toWorkspaceAccountProfile(response),
    workspaces: response.workspaces,
    selectedWorkspaceId: response.selected_workspace_id,
    selectedWorkspace: response.selected_workspace,
  };
}
