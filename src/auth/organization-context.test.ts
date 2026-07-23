import { beforeEach, describe, expect, it, vi } from "vitest";

const workspaceApi = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  selectWorkspace: vi.fn(),
}));

vi.mock("../services/scena-api/workspaces", async (importActual) => {
  const actual =
    await importActual<typeof import("../services/scena-api/workspaces")>();
  return {
    ...actual,
    getWorkspaceContext: workspaceApi.getWorkspaceContext,
    selectWorkspace: workspaceApi.selectWorkspace,
  };
});

import {
  loadAccountContext,
  switchAccountWorkspace,
  toManagerContext,
} from "./organization-context";

const personalWorkspace = {
  id: "workspace-1",
  name: "Personal Workspace",
  slug: "personal-workspace",
  type: "personal" as const,
  owner_user_id: "user-1",
  provisioning_kind: "personal_free",
  status: "active" as const,
  role: "owner" as const,
  joined_at: "2026-07-23T00:00:00.000Z",
  entitlements: {
    plan_code: "personal_free",
    max_displays: 2,
    max_boards: 5,
    max_members: 1,
    max_concurrent_sessions: 1,
    max_displays_per_session: 2,
    max_asset_uploads_per_month: 5,
    automation_tier: "none",
    allow_display_groups: false,
    allow_session_groups: false,
    allow_resource_access_controls: false,
  },
};

const response = {
  user_id: "user-1",
  profile: {
    display_name: "Ada",
    avatar_url: null,
    onboarding_state: "complete",
    timezone: "UTC",
  },
  workspaces: [personalWorkspace],
  selected_workspace_id: personalWorkspace.id,
  selected_workspace: personalWorkspace,
  request_id: "request-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  workspaceApi.getWorkspaceContext.mockResolvedValue(response);
  workspaceApi.selectWorkspace.mockResolvedValue(response);
});

describe("Workspace account context", () => {
  it("loads a Personal Workspace as a valid manager context", async () => {
    const account = await loadAccountContext();
    const manager = toManagerContext(account);

    expect(manager).toMatchObject({
      userId: "user-1",
      workspace: {
        id: "workspace-1",
        type: "personal",
      },
      organization: {
        id: "workspace-1",
      },
      role: "owner",
    });
  });

  it("switches through the canonical Workspace API", async () => {
    await switchAccountWorkspace("workspace-1");
    expect(workspaceApi.selectWorkspace).toHaveBeenCalledWith("workspace-1");
  });

  it("returns null only when no selected Workspace exists", () => {
    expect(toManagerContext({
      userId: "user-1",
      profile: {
        displayName: "Ada",
        avatarUrl: null,
        onboardingState: "complete",
        timezone: "UTC",
      },
      workspaces: [],
      selectedWorkspaceId: null,
      selectedWorkspace: null,
    })).toBeNull();
  });
});
