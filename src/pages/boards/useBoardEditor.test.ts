import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBoardEditor } from "./useBoardEditor";
import { ScenaApiError } from "../../services/scena-api/errors";

const mockGetBoard = vi.fn();
const mockSaveBoard = vi.fn();
const mockCreateBoard = vi.fn();
const mockCreateBoardRevision = vi.fn();
const mockListBoardRevisions = vi.fn();

vi.mock("../../services/scena-api/boards", async (importActual) => {
  const actual = await importActual<typeof import("../../services/scena-api/boards")>();
  return {
    ...actual,
    getBoard: (...args: unknown[]) => mockGetBoard(...args),
    saveBoard: (...args: unknown[]) => mockSaveBoard(...args),
    createBoard: (...args: unknown[]) => mockCreateBoard(...args),
    createBoardRevision: (...args: unknown[]) => mockCreateBoardRevision(...args),
    listBoardRevisions: (...args: unknown[]) => mockListBoardRevisions(...args),
  };
});

function baseSnapshot() {
  return {
    board: {
      id: "board-1", workspace_id: "ws-1", name: "Untitled Board",
      canvas_width: 1920, canvas_height: 1080, background_color: "#000000",
      status: "active" as const, version: 3,
    },
    scenes: [
      {
        id: "scene-1", name: "Scene 1", sort_order: 0, duration_ms: 10_000,
        transition_type: "fade" as const, transition_config: {}, background: {}, is_hidden: false,
        elements: [
          { id: "el-1", element_type: "text" as const, render_mode: "static" as const, name: null,
            x: 10, y: 10, width: 20, height: 10, rotation: 0, opacity: 1, z_index: 0,
            is_locked: false, is_visible: true, asset_id: null, asset_page_id: null, config: { text: "Hello" } },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBoard.mockResolvedValue({ snapshot: baseSnapshot(), request_id: "req-1" });
});

describe("useBoardEditor", () => {
  it("loads the board snapshot", async () => {
    const { result } = renderHook(() => useBoardEditor("board-1", "ws-1"));
    await waitFor(() => expect(result.current.saveState).toBe("idle"));
    expect(result.current.snapshot?.board.name).toBe("Untitled Board");
    expect(result.current.selectedScene?.id).toBe("scene-1");
  });

  it("tracks unsaved state and undo/redo across a mutation", async () => {
    const { result } = renderHook(() => useBoardEditor("board-1", "ws-1"));
    await waitFor(() => expect(result.current.saveState).toBe("idle"));

    act(() => result.current.updateElement("scene-1", "el-1", { x: 50 }));
    expect(result.current.saveState).toBe("unsaved");
    expect(result.current.snapshot?.scenes[0].elements[0].x).toBe(50);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.snapshot?.scenes[0].elements[0].x).toBe(10);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.snapshot?.scenes[0].elements[0].x).toBe(50);
  });

  it("saves successfully and advances the tracked version", async () => {
    mockSaveBoard.mockResolvedValue({ board_id: "board-1", version: 4, scene_count: 1, element_count: 1, request_id: "req-2" });
    const { result } = renderHook(() => useBoardEditor("board-1", "ws-1"));
    await waitFor(() => expect(result.current.saveState).toBe("idle"));

    act(() => result.current.updateElement("scene-1", "el-1", { x: 77 }));
    await act(async () => result.current.save());

    expect(mockSaveBoard).toHaveBeenCalledWith("board-1", 3, expect.objectContaining({ scenes: expect.any(Array) }));
    expect(result.current.saveState).toBe("saved");
    expect(result.current.snapshot?.board.version).toBe(4);
  });

  it("enters conflict state on BOARD_VERSION_CONFLICT and reloadLatest re-fetches", async () => {
    mockSaveBoard.mockRejectedValue(new ScenaApiError("BOARD_VERSION_CONFLICT", "changed elsewhere", 409, "req-3"));
    const { result } = renderHook(() => useBoardEditor("board-1", "ws-1"));
    await waitFor(() => expect(result.current.saveState).toBe("idle"));

    act(() => result.current.updateElement("scene-1", "el-1", { x: 99 }));
    await act(async () => result.current.save());
    expect(result.current.saveState).toBe("conflict");

    mockGetBoard.mockResolvedValue({ snapshot: baseSnapshot(), request_id: "req-4" });
    act(() => result.current.reloadLatest());
    await waitFor(() => expect(result.current.saveState).toBe("idle"));
    expect(result.current.snapshot?.scenes[0].elements[0].x).toBe(10);
  });

  it("saveAsCopy creates a new Board and saves the draft into it", async () => {
    mockCreateBoard.mockResolvedValue({
      board: { id: "board-2", workspace_id: "ws-1", name: "Untitled Board (copy)", canvas_width: 1920, canvas_height: 1080, background_color: "#000000", status: "active", version: 1, created_by: "u1", updated_by: "u1", created_at: "now", updated_at: "now" },
      initial_scene_id: "scene-x",
      request_id: "req-5",
    });
    mockSaveBoard.mockResolvedValue({ board_id: "board-2", version: 2, scene_count: 1, element_count: 1, request_id: "req-6" });

    const { result } = renderHook(() => useBoardEditor("board-1", "ws-1"));
    await waitFor(() => expect(result.current.saveState).toBe("idle"));

    let newId: string | null = null;
    await act(async () => {
      newId = await result.current.saveAsCopy();
    });

    expect(mockCreateBoard).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws-1" }));
    expect(mockSaveBoard).toHaveBeenCalledWith("board-2", 1, expect.any(Object));
    expect(newId).toBe("board-2");
  });
});
