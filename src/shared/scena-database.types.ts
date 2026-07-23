// Live-schema compatibility overlay for Scena's Workspace, Asset, and Board
// entities. The baseline database.types.ts remains generated from Supabase;
// this additive overlay keeps the browser client strongly typed for the
// UI-integration surfaces introduced after that baseline was generated.

import type {
  Database as GeneratedDatabase,
  Json,
} from "./database.types";

type PublicSchema = GeneratedDatabase["public"];
type ExistingViews =
  PublicSchema extends { Views: infer Views } ? Views : Record<string, never>;
type ExistingFunctions =
  PublicSchema extends { Functions: infer Functions }
    ? Functions
    : Record<string, never>;

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface AssetRow {
  id: string;
  workspace_id: string;
  asset_kind: string;
  original_filename: string;
  mime_type: string;
  source_bucket: string;
  source_object_path: string | null;
  source_size_bytes: number | null;
  source_checksum_sha256: string | null;
  status: string;
  page_count: number | null;
  metadata: Json;
  error_code: string | null;
  error_message_safe: string | null;
  uploaded_by: string;
  source_uploaded_at: string | null;
  processed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetPageRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  page_number: number;
  title: string | null;
  extracted_text: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface AssetVariantRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  asset_page_id: string | null;
  variant_type: string;
  bucket_id: string;
  object_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  metadata: Json;
  created_at: string;
}

export interface AssetProcessingJobRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  job_type: string;
  status: string;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  lease_owner: string | null;
  lease_token_hash: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expected_outputs: Json;
  error_code: string | null;
  error_message_safe: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardRow {
  id: string;
  workspace_id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  status: string;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface BoardSceneRow {
  id: string;
  workspace_id: string;
  board_id: string;
  name: string;
  sort_order: number;
  duration_ms: number;
  transition_type: string;
  transition_config: Json;
  background: Json;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface SceneElementRow {
  id: string;
  workspace_id: string;
  board_id: string;
  scene_id: string;
  element_type: string;
  render_mode: string;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  z_index: number;
  is_locked: boolean;
  is_visible: boolean;
  asset_id: string | null;
  asset_page_id: string | null;
  config: Json;
  created_at: string;
  updated_at: string;
}

export interface BoardRevisionRow {
  id: string;
  workspace_id: string;
  board_id: string;
  board_version: number;
  label: string | null;
  snapshot: Json;
  created_by: string;
  created_at: string;
}

export interface WorkspaceViewRow {
  id: string | null;
  name: string | null;
  slug: string | null;
  type: string | null;
  owner_user_id: string | null;
  provisioning_kind: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkspaceMembershipViewRow {
  workspace_id: string | null;
  user_id: string | null;
  role: string | null;
  status: string | null;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkspaceEntitlementViewRow {
  workspace_id: string | null;
  plan_code: string | null;
  max_displays: number | null;
  max_boards: number | null;
  max_members: number | null;
  max_concurrent_sessions: number | null;
  max_displays_per_session: number | null;
  max_asset_uploads_per_month: number | null;
  automation_tier: string | null;
  allow_display_groups: boolean | null;
  allow_session_groups: boolean | null;
  allow_resource_access_controls: boolean | null;
  updated_at: string | null;
}

export type ScenaDatabase = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Views" | "Functions"> & {
    Tables: PublicSchema["Tables"] & {
      assets: Table<AssetRow>;
      asset_pages: Table<AssetPageRow>;
      asset_variants: Table<AssetVariantRow>;
      asset_processing_jobs: Table<AssetProcessingJobRow>;
      boards: Table<BoardRow>;
      board_scenes: Table<BoardSceneRow>;
      scene_elements: Table<SceneElementRow>;
      board_revisions: Table<BoardRevisionRow>;
    };
    Views: ExistingViews & {
      workspaces: View<WorkspaceViewRow>;
      workspace_memberships: View<WorkspaceMembershipViewRow>;
      workspace_entitlements: View<WorkspaceEntitlementViewRow>;
    };
    Functions: ExistingFunctions & {
      board_snapshot: {
        Args: { target_board_id: string };
        Returns: Json;
      };
      save_board_draft: {
        Args: {
          target_board_id: string;
          expected_version: number;
          target_snapshot: Json;
        };
        Returns: Json;
      };
      create_board_revision: {
        Args: {
          target_board_id: string;
          target_label?: string;
        };
        Returns: Json;
      };
    };
  };
};
