// Board editor state: load → local draft with undo/redo → save with
// optimistic version conflict handling. Kept separate from the page
// component so BoardEditorPage.tsx stays about layout, not state machinery.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBoard, saveBoard, createBoard, createBoardRevision, listBoardRevisions, isBoardVersionConflict,
} from "../../services/scena-api/boards";
import type { BoardSnapshot, BoardScene, SceneElement, BoardRevision } from "../../services/scena-api/boards";

export type SaveState = "loading" | "idle" | "unsaved" | "saving" | "saved" | "failed" | "conflict";

const MAX_HISTORY = 50;

export function useBoardEditor(boardId: string, workspaceId: string) {
  const [snapshot, setSnapshotState] = useState<BoardSnapshot | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<BoardRevision[]>([]);

  const history = useRef<{ past: BoardSnapshot[]; future: BoardSnapshot[] }>({ past: [], future: [] });
  const savedVersion = useRef<number>(0);

  const load = useCallback(() => {
    setSaveState("loading");
    setLoadError(null);
    getBoard(boardId)
      .then((res) => {
        setSnapshotState(res.snapshot);
        savedVersion.current = res.snapshot.board.version ?? 0;
        setSelectedSceneId(res.snapshot.scenes[0]?.id ?? null);
        history.current = { past: [], future: [] };
        setSaveState("idle");
      })
      .catch((err) => {
        setLoadError(err);
        setSaveState("failed");
      });
  }, [boardId]);

  useEffect(load, [load]);

  const mutate = useCallback((updater: (draft: BoardSnapshot) => BoardSnapshot) => {
    setSnapshotState((prev) => {
      if (!prev) return prev;
      history.current.past = [...history.current.past.slice(-MAX_HISTORY + 1), prev];
      history.current.future = [];
      const next = updater(prev);
      setSaveState("unsaved");
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setSnapshotState((current) => {
      const prev = history.current.past.pop();
      if (!prev || !current) return current;
      history.current.future = [current, ...history.current.future].slice(0, MAX_HISTORY);
      setSaveState("unsaved");
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setSnapshotState((current) => {
      const next = history.current.future.shift();
      if (!next || !current) return current;
      history.current.past = [...history.current.past, current].slice(-MAX_HISTORY);
      setSaveState("unsaved");
      return next;
    });
  }, []);

  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  const save = useCallback(async () => {
    if (!snapshot) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const result = await saveBoard(boardId, savedVersion.current, snapshot);
      savedVersion.current = result.version;
      setSnapshotState((prev) => (prev ? { ...prev, board: { ...prev.board, version: result.version } } : prev));
      setSaveState("saved");
    } catch (err) {
      if (isBoardVersionConflict(err)) {
        setSaveState("conflict");
      } else {
        setSaveError(err);
        setSaveState("failed");
      }
    }
  }, [boardId, snapshot]);

  /** Recovery from BOARD_VERSION_CONFLICT: discard local changes, reload
   * the latest server snapshot. */
  const reloadLatest = useCallback(() => {
    load();
  }, [load]);

  /** Recovery from BOARD_VERSION_CONFLICT: keep local changes by pushing
   * them into a brand-new Board instead of overwriting the one that moved
   * underneath us. */
  const saveAsCopy = useCallback(async (): Promise<string | null> => {
    if (!snapshot) return null;
    setSaveState("saving");
    try {
      const created = await createBoard({
        workspaceId,
        name: `${snapshot.board.name} (copy)`,
        canvasWidth: snapshot.board.canvas_width,
        canvasHeight: snapshot.board.canvas_height,
        backgroundColor: snapshot.board.background_color,
      });
      const copySnapshot: BoardSnapshot = {
        board: { ...snapshot.board, id: created.board.id, workspace_id: workspaceId, version: created.board.version },
        scenes: snapshot.scenes,
      };
      const saved = await saveBoard(created.board.id, created.board.version, copySnapshot);
      setSaveState("saved");
      return created.board.id + (saved.version ? "" : "");
    } catch (err) {
      setSaveError(err);
      setSaveState("failed");
      return null;
    }
  }, [snapshot, workspaceId]);

  const rename = useCallback((name: string) => {
    mutate((draft) => ({ ...draft, board: { ...draft.board, name } }));
  }, [mutate]);

  const selectedScene = snapshot?.scenes.find((scene) => scene.id === selectedSceneId) ?? snapshot?.scenes[0] ?? null;
  const selectedElement = selectedScene?.elements.find((element) => element.id === selectedElementId) ?? null;

  function updateScene(sceneId: string, patch: Partial<BoardScene>) {
    mutate((draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene)),
    }));
  }

  function updateElement(sceneId: string, elementId: string, patch: Partial<SceneElement>) {
    mutate((draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) =>
        scene.id === sceneId
          ? { ...scene, elements: scene.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)) }
          : scene,
      ),
    }));
  }

  function addElement(sceneId: string, element: SceneElement) {
    mutate((draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) => (scene.id === sceneId ? { ...scene, elements: [...scene.elements, element] } : scene)),
    }));
    setSelectedElementId(element.id);
  }

  function removeElement(sceneId: string, elementId: string) {
    mutate((draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) =>
        scene.id === sceneId ? { ...scene, elements: scene.elements.filter((element) => element.id !== elementId) } : scene,
      ),
    }));
    setSelectedElementId(null);
  }

  function addScene(scene: BoardScene) {
    mutate((draft) => ({ ...draft, scenes: [...draft.scenes, scene] }));
    setSelectedSceneId(scene.id);
  }

  function reorderScenes(sceneId: string, direction: "left" | "right") {
    mutate((draft) => {
      const index = draft.scenes.findIndex((scene) => scene.id === sceneId);
      const swapWith = direction === "left" ? index - 1 : index + 1;
      if (index === -1 || swapWith < 0 || swapWith >= draft.scenes.length) return draft;
      const scenes = [...draft.scenes];
      [scenes[index], scenes[swapWith]] = [scenes[swapWith], scenes[index]];
      return { ...draft, scenes: scenes.map((scene, order) => ({ ...scene, sort_order: order })) };
    });
  }

  async function loadRevisions() {
    try {
      const res = await listBoardRevisions(boardId);
      setRevisions(res.revisions);
    } catch {
      setRevisions([]);
    }
  }

  async function createRevision(label?: string) {
    await createBoardRevision(boardId, label);
    await loadRevisions();
  }

  return {
    snapshot,
    saveState,
    loadError,
    saveError,
    selectedScene,
    selectedSceneId,
    setSelectedSceneId,
    selectedElement,
    selectedElementId,
    setSelectedElementId,
    revisions,
    canUndo,
    canRedo,
    undo,
    redo,
    save,
    reloadLatest,
    saveAsCopy,
    rename,
    updateScene,
    updateElement,
    addElement,
    removeElement,
    addScene,
    reorderScenes,
    loadRevisions,
    createRevision,
  };
}
