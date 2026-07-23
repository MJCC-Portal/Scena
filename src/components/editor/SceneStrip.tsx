import { Plus, EyeSlash, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { BoardScene } from "../../services/scena-api/boards";
import { IconButton } from "../ui/Button";

export interface SceneStripProps {
  scenes: BoardScene[];
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
  onAddScene: () => void;
  onReorder: (sceneId: string, direction: "left" | "right") => void;
}

export function SceneStrip({ scenes, selectedSceneId, onSelect, onAddScene, onReorder }: SceneStripProps) {
  return (
    <div className="scena-editor__scene-strip">
      {scenes.map((scene, index) => (
        <div
          key={scene.id}
          className={`scena-editor__scene-thumb${scene.id === selectedSceneId ? " scena-editor__scene-thumb--active" : ""}${scene.is_hidden ? " scena-editor__scene-thumb--hidden" : ""}`}
          onClick={() => onSelect(scene.id)}
        >
          {scene.is_hidden && <EyeSlash size={12} style={{ position: "absolute", top: 4, right: 4 }} />}
          <span style={{ fontWeight: 600, color: "var(--scena-text-secondary)" }}>{scene.name}</span>
          <span>{(scene.duration_ms / 1000).toFixed(0)}s · {scene.transition_type}</span>
          {scene.id === selectedSceneId && (
            <div style={{ position: "absolute", bottom: 2, display: "flex", gap: 2 }}>
              <IconButton
                icon={<CaretLeft size={10} />}
                label="Move scene earlier"
                size="sm"
                disabled={index === 0}
                onClick={(event) => { event.stopPropagation(); onReorder(scene.id, "left"); }}
                style={{ width: 20, height: 16 }}
              />
              <IconButton
                icon={<CaretRight size={10} />}
                label="Move scene later"
                size="sm"
                disabled={index === scenes.length - 1}
                onClick={(event) => { event.stopPropagation(); onReorder(scene.id, "right"); }}
                style={{ width: 20, height: 16 }}
              />
            </div>
          )}
        </div>
      ))}
      <IconButton icon={<Plus size={20} />} label="Add scene" onClick={onAddScene} />
    </div>
  );
}
