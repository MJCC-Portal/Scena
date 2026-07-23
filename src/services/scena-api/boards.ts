import { callScenaFunction } from "./client";
import { isBoardVersionConflict } from "./errors";

export type BoardStatus = "active" | "archived";
export type ElementType =
  | "text"
  | "image"
  | "shape"
  | "asset_page"
  | "clock"
  | "date"
  | "countdown"
  | "qr_static"
  | "qr_dynamic"
  | "music_player"
  | "ticker"
  | "carousel"
  | "video"
  | "weather"
  | "data_text";
export type RenderMode = "static" | "live" | "interactive";
export type TransitionType =
  | "none"
  | "fade"
  | "slide_left"
  | "slide_right"
  | "zoom"
  | "dissolve";

export interface BoardSummary {
  id: string;
  workspace_id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  status: BoardStatus;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SceneElement {
  id: string;
  element_type: ElementType;
  render_mode: RenderMode;
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
  config: Record<string, unknown>;
}

export interface BoardScene {
  id: string;
  name: string;
  sort_order: number;
  duration_ms: number;
  transition_type: TransitionType;
  transition_config: Record<string, unknown>;
  background: Record<string, unknown>;
  is_hidden: boolean;
  elements: SceneElement[];
}

export interface BoardSnapshot {
  board: {
    id?: string;
    workspace_id?: string;
    name: string;
    canvas_width: number;
    canvas_height: number;
    background_color: string;
    status?: BoardStatus;
    version?: number;
  };
  scenes: BoardScene[];
}

export interface BoardRevision {
  id: string;
  workspace_id: string;
  board_id: string;
  board_version: number;
  label: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateBoardInput {
  workspaceId: string;
  name: string;
  canvasWidth?: number;
  canvasHeight?: number;
  backgroundColor?: string;
  signal?: AbortSignal;
}

export async function listBoards(
  workspaceId: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<{ boards: BoardSummary[]; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "list",
      workspace_id: workspaceId,
      limit,
    },
    { signal },
  );
}

export async function createBoard(
  input: CreateBoardInput,
): Promise<{ board: BoardSummary; initial_scene_id: string; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "create",
      workspace_id: input.workspaceId,
      name: input.name,
      canvas_width: input.canvasWidth ?? 1920,
      canvas_height: input.canvasHeight ?? 1080,
      background_color: input.backgroundColor ?? "#000000",
    },
    { signal: input.signal },
  );
}

export async function getBoard(
  boardId: string,
  signal?: AbortSignal,
): Promise<{ snapshot: BoardSnapshot; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    { action: "get", board_id: boardId },
    { signal },
  );
}

export async function saveBoard(
  boardId: string,
  baseVersion: number,
  snapshot: BoardSnapshot,
  signal?: AbortSignal,
): Promise<{
  board_id: string;
  version: number;
  scene_count: number;
  element_count: number;
  request_id: string;
}> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "save",
      board_id: boardId,
      base_version: baseVersion,
      snapshot,
    },
    { signal },
  );
}

export async function createBoardRevision(
  boardId: string,
  label?: string,
  signal?: AbortSignal,
): Promise<{
  revision_id: string;
  board_id: string;
  version: number;
  request_id: string;
}> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "create_revision",
      board_id: boardId,
      ...(label ? { label } : {}),
    },
    { signal },
  );
}

export async function listBoardRevisions(
  boardId: string,
  limit = 25,
  signal?: AbortSignal,
): Promise<{ revisions: BoardRevision[]; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "list_revisions",
      board_id: boardId,
      limit,
    },
    { signal },
  );
}

export async function archiveBoard(
  boardId: string,
  signal?: AbortSignal,
): Promise<{ board_id: string; status: "archived"; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    { action: "archive", board_id: boardId },
    { signal },
  );
}

export function createBlankBoardSnapshot(
  board: BoardSummary,
  initialSceneId: string,
): BoardSnapshot {
  return {
    board: {
      id: board.id,
      workspace_id: board.workspace_id,
      name: board.name,
      canvas_width: board.canvas_width,
      canvas_height: board.canvas_height,
      background_color: board.background_color,
      status: board.status,
      version: board.version,
    },
    scenes: [
      {
        id: initialSceneId,
        name: "Scene 1",
        sort_order: 0,
        duration_ms: 10_000,
        transition_type: "fade",
        transition_config: {},
        background: {
          type: "color",
          value: board.background_color,
        },
        is_hidden: false,
        elements: [],
      },
    ],
  };
}

export { isBoardVersionConflict };
