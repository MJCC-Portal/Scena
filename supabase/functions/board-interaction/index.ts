import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const EDITOR_ROLES = new Set(["owner", "admin", "operator", "designer"]);
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type Context = {
  userId: string;
  admin: SupabaseClient;
  userClient: SupabaseClient;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return error("METHOD_NOT_ALLOWED", "POST required.", 405);

  const requestId = crypto.randomUUID();
  try {
    const context = await authenticate(req);
    const body = await req.json() as Record<string, unknown>;
    const action = text(body.action);

    if (action === "list") return await listBoards(context, body, requestId);
    if (action === "create") return await createBoard(context, body, requestId);
    if (action === "get") return await getBoard(context, body, requestId);
    if (action === "save") return await saveBoard(context, body, requestId);
    if (action === "create_revision") return await createRevision(context, body, requestId);
    if (action === "list_revisions") return await listRevisions(context, body, requestId);
    if (action === "archive") return await archiveBoard(context, body, requestId);

    return error("VALIDATION_FAILED", "Unknown action.", 400, requestId);
  } catch (cause) {
    console.error(JSON.stringify({
      event: "board_interaction_failed",
      request_id: requestId,
      error_name: cause instanceof Error ? cause.name : "unknown",
      error_message: cause instanceof Error ? cause.message : "unknown",
    }));
    return mapError(cause, requestId);
  }
});

async function listBoards(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const workspaceId = uuid(body.workspace_id, "workspace_id");
  await requireWorkspaceRole(context.admin, workspaceId, context.userId, false);
  const limit = clampInteger(body.limit, 50, 1, 100);

  const { data, error: queryError } = await context.userClient
    .from("boards")
    .select("id,workspace_id,name,canvas_width,canvas_height,background_color,status,version,created_by,updated_by,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (queryError) throw new Error(`Board list failed: ${queryError.message}`);
  return json({ boards: data ?? [], request_id: requestId });
}

async function createBoard(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const workspaceId = uuid(body.workspace_id, "workspace_id");
  await requireWorkspaceRole(context.admin, workspaceId, context.userId, true);

  const name = text(body.name);
  const canvasWidth = clampInteger(body.canvas_width, 1920, 64, 7680);
  const canvasHeight = clampInteger(body.canvas_height, 1080, 64, 7680);
  const backgroundColor = text(body.background_color) || "#000000";
  if (!name || name.length > 120) return error("VALIDATION_FAILED", "Board name is required and must be at most 120 characters.", 400, requestId);
  if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(backgroundColor)) return error("VALIDATION_FAILED", "background_color must be a hexadecimal color.", 400, requestId);

  const boardId = crypto.randomUUID();
  const sceneId = crypto.randomUUID();
  const { data: board, error: boardError } = await context.admin
    .from("boards")
    .insert({
      id: boardId,
      workspace_id: workspaceId,
      name,
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
      background_color: backgroundColor,
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select("id,workspace_id,name,canvas_width,canvas_height,background_color,status,version,created_at,updated_at")
    .single();
  if (boardError) throw new Error(boardError.message);

  const { error: sceneError } = await context.admin.from("board_scenes").insert({
    id: sceneId,
    workspace_id: workspaceId,
    board_id: boardId,
    name: "Scene 1",
    sort_order: 0,
    duration_ms: 10_000,
    transition_type: "fade",
    background: { type: "color", value: backgroundColor },
  });
  if (sceneError) {
    await context.admin.from("boards").delete().eq("id", boardId);
    throw new Error(`default Scene creation failed: ${sceneError.message}`);
  }

  return json({ board, initial_scene_id: sceneId, request_id: requestId }, 201);
}

async function getBoard(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const boardId = uuid(body.board_id, "board_id");
  const { data, error: snapshotError } = await context.userClient.rpc("board_snapshot", { target_board_id: boardId });
  if (snapshotError) throw new Error(snapshotError.message);
  return json({ snapshot: data, request_id: requestId });
}

async function saveBoard(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const boardId = uuid(body.board_id, "board_id");
  const baseVersion = requiredInteger(body.base_version, "base_version");
  const snapshot = isRecord(body.snapshot) ? body.snapshot : null;
  if (!snapshot) return error("VALIDATION_FAILED", "snapshot must be an object.", 400, requestId);

  const { data, error: saveError } = await context.userClient.rpc("save_board_draft", {
    target_board_id: boardId,
    expected_version: baseVersion,
    target_snapshot: snapshot,
  });
  if (saveError) throw new Error(saveError.message);
  return json({ ...asRecord(data), request_id: requestId });
}

async function createRevision(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const boardId = uuid(body.board_id, "board_id");
  const label = text(body.label) || null;
  if (label && label.length > 120) return error("VALIDATION_FAILED", "Revision label must be at most 120 characters.", 400, requestId);
  const { data, error: revisionError } = await context.userClient.rpc("create_board_revision", {
    target_board_id: boardId,
    target_label: label,
  });
  if (revisionError) throw new Error(revisionError.message);
  return json({ ...asRecord(data), request_id: requestId }, 201);
}

async function listRevisions(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const boardId = uuid(body.board_id, "board_id");
  const limit = clampInteger(body.limit, 25, 1, 100);
  const { data, error: queryError } = await context.userClient
    .from("board_revisions")
    .select("id,workspace_id,board_id,board_version,label,created_by,created_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (queryError) throw new Error(`revision list failed: ${queryError.message}`);
  return json({ revisions: data ?? [], request_id: requestId });
}

async function archiveBoard(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const boardId = uuid(body.board_id, "board_id");
  const { data: board, error: boardError } = await context.admin.from("boards").select("id,workspace_id,status").eq("id", boardId).maybeSingle();
  if (boardError) throw new Error(`Board lookup failed: ${boardError.message}`);
  if (!board) return error("BOARD_NOT_FOUND", "Board not found.", 404, requestId);
  await requireWorkspaceRole(context.admin, String(board.workspace_id), context.userId, true);
  const { error: archiveError } = await context.admin.from("boards").update({
    status: "archived",
    archived_at: new Date().toISOString(),
    updated_by: context.userId,
  }).eq("id", boardId);
  if (archiveError) throw new Error(`Board archive failed: ${archiveError.message}`);
  return json({ board_id: boardId, status: "archived", request_id: requestId });
}

async function authenticate(req: Request): Promise<Context> {
  const supabaseUrl = required("SUPABASE_URL");
  const anonKey = required("SUPABASE_ANON_KEY");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError("UNAUTHENTICATED", "Sign in is required.", 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !data.user) throw new HttpError("UNAUTHENTICATED", "Sign in is required.", 401);
  return { userId: data.user.id, admin, userClient };
}

async function requireWorkspaceRole(admin: SupabaseClient, workspaceId: string, userId: string, editor: boolean): Promise<string> {
  const { data, error: membershipError } = await admin
    .from("organization_members")
    .select("role,status,organizations(status)")
    .eq("org_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) throw new Error(`membership lookup failed: ${membershipError.message}`);
  if (!data || data.status !== "active") throw new HttpError("WORKSPACE_ACCESS_DENIED", "Workspace membership is required.", 403);
  const workspace = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  if (workspace?.status !== "active") throw new HttpError("WORKSPACE_SUSPENDED", "This Workspace is suspended.", 403);
  const role = String(data.role);
  if (editor && !EDITOR_ROLES.has(role)) throw new HttpError("EDITOR_ROLE_REQUIRED", "An editor role is required.", 403);
  return role;
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uuid(value: unknown, field: string): string {
  const parsed = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new HttpError("VALIDATION_FAILED", `${field} must be a UUID.`, 400);
  }
  return parsed;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function requiredInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new HttpError("VALIDATION_FAILED", `${field} must be an integer.`, 400);
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

class HttpError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function mapError(cause: unknown, requestId: string): Response {
  if (cause instanceof HttpError) return error(cause.code, cause.message, cause.status, requestId);
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("board not found")) return error("BOARD_NOT_FOUND", "Board not found.", 404, requestId);
  if (message.includes("board version conflict")) {
    const match = message.match(/current (\d+)/);
    return error("BOARD_VERSION_CONFLICT", "This Board changed in another editor. Reload the latest version before saving.", 409, requestId, match ? { current_version: Number(match[1]) } : undefined);
  }
  if (message.includes("workspace Board limit reached")) return error("BOARD_LIMIT_REACHED", "This Workspace has reached its active Board limit.", 409, requestId);
  if (message.includes("editor role required")) return error("EDITOR_ROLE_REQUIRED", "An editor role is required.", 403, requestId);
  if (message.includes("scene limit exceeded") || message.includes("element limit exceeded") || message.includes("invalid Board snapshot")) return error("BOARD_VALIDATION_FAILED", "The Board draft is invalid or exceeds an editor limit.", 400, requestId);
  return error("INTERNAL_ERROR", "The Board request could not be completed.", 500, requestId);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function error(code: string, message: string, status: number, requestId?: string, details?: Record<string, unknown>): Response {
  return json({ error: { code, message, ...(requestId ? { request_id: requestId } : {}), ...(details ? { details } : {}) } }, status);
}
