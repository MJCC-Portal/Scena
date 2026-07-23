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
export type ShapeVariant =
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "star"
  | "line"
  | "arrow";
export const SHAPE_VARIANTS: readonly ShapeVariant[] = [
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "hexagon",
  "star",
  "line",
  "arrow",
];

export type BorderStyle = "solid" | "dashed" | "dotted";

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

/** Generic border config, applicable to every element type. border_width of
 * 0 is the explicit "no border" state — not merely a falsy default. */
export interface ElementBorderConfig {
  border_width: number;
  border_color: string;
  border_style: BorderStyle;
}

/** Shape-only config: geometry variant, fill (+opacity), corner radius,
 * plus the generic border fields every element type also reads. */
export interface ShapeConfig extends ElementBorderConfig {
  variant: ShapeVariant;
  fill: string;
  fill_opacity: number;
  corner_radius: number;
}

const DEFAULT_BORDER_CONFIG: ElementBorderConfig = {
  border_width: 0,
  border_color: "#ffffff",
  border_style: "solid",
};

/** Normalizing reader for the generic border config keys. Backward
 * compatible with elements saved before borders existed: a missing
 * border_width reads as 0 (borderless), not an error. */
export function readBorderConfig(element: { config: Record<string, unknown> | null | undefined }): ElementBorderConfig {
  const config = (element.config ?? {}) as Record<string, unknown>;
  const width = Number(config.border_width);
  const style = config.border_style;
  return {
    border_width: Number.isFinite(width) && width >= 0 ? width : DEFAULT_BORDER_CONFIG.border_width,
    border_color: typeof config.border_color === "string" && config.border_color ? config.border_color : DEFAULT_BORDER_CONFIG.border_color,
    border_style: style === "dashed" || style === "dotted" || style === "solid" ? style : DEFAULT_BORDER_CONFIG.border_style,
  };
}

/** Normalizing reader for shape config. A missing variant reads as
 * "rectangle" so elements saved with config `{}` or `{ fill: "#xxx" }`
 * (pre-variant, pre-border) keep rendering. */
export function readShapeConfig(element: { config: Record<string, unknown> | null | undefined }): ShapeConfig {
  const config = (element.config ?? {}) as Record<string, unknown>;
  const variantValue = typeof config.variant === "string" ? config.variant : "rectangle";
  const variant: ShapeVariant = (SHAPE_VARIANTS as readonly string[]).includes(variantValue)
    ? (variantValue as ShapeVariant)
    : "rectangle";
  const fillOpacity = Number(config.fill_opacity);
  const cornerRadius = Number(config.corner_radius);
  return {
    ...readBorderConfig(element),
    variant,
    fill: typeof config.fill === "string" && config.fill ? config.fill : "#5b7cfa",
    fill_opacity: Number.isFinite(fillOpacity) ? Math.min(1, Math.max(0, fillOpacity)) : 1,
    corner_radius: Number.isFinite(cornerRadius) && cornerRadius >= 0 ? cornerRadius : 0,
  };
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
