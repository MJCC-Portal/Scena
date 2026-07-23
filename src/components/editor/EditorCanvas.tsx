// Canvas rendering + drag/resize/rotate. Interaction state (the in-flight
// drag/resize/rotate delta) stays local to this component; only the final
// value on pointer-up is committed to the editor's undo-tracked state, so a
// whole drag gesture is one undo step, not one per pixel of movement.
import { useRef, useState } from "react";
import type { BoardScene, SceneElement } from "../../services/scena-api/boards";

type DragKind = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" | "rotate";

interface DragState {
  kind: DragKind;
  elementId: string;
  startX: number;
  startY: number;
  origin: { x: number; y: number; width: number; height: number; rotation: number };
}

export interface EditorCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  scene: BoardScene;
  selectedElementId: string | null;
  onSelect: (elementId: string | null) => void;
  onCommit: (elementId: string, patch: Partial<SceneElement>) => void;
  zoom: number;
}

const BASE_SCALE = 0.4;
const SNAP_THRESHOLD = 1.5;

export function EditorCanvas({
  canvasWidth, canvasHeight, backgroundColor, scene, selectedElementId, onSelect, onCommit, zoom,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [live, setLive] = useState<Partial<SceneElement> | null>(null);
  const [snapLines, setSnapLines] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const scale = (zoom / 100) * BASE_SCALE;
  const displayWidth = canvasWidth * scale;
  const displayHeight = canvasHeight * scale;

  function beginDrag(kind: DragKind, element: SceneElement, event: React.PointerEvent) {
    if (element.is_locked && kind === "move") return;
    event.stopPropagation();
    onSelect(element.id);
    (event.target as Element).setPointerCapture(event.pointerId);
    setDrag({
      kind,
      elementId: element.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: element.x, y: element.y, width: element.width, height: element.height, rotation: element.rotation },
    });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPercent = ((event.clientX - drag.startX) / rect.width) * 100;
    const dyPercent = ((event.clientY - drag.startY) / rect.height) * 100;

    if (drag.kind === "move") {
      let x = clamp(drag.origin.x + dxPercent, 0, 100 - drag.origin.width);
      let y = clamp(drag.origin.y + dyPercent, 0, 100 - drag.origin.height);
      const centerX = x + drag.origin.width / 2;
      const centerY = y + drag.origin.height / 2;
      const snapV = Math.abs(centerX - 50) < SNAP_THRESHOLD;
      const snapH = Math.abs(centerY - 50) < SNAP_THRESHOLD;
      if (snapV) x = 50 - drag.origin.width / 2;
      if (snapH) y = 50 - drag.origin.height / 2;
      setSnapLines({ v: snapV, h: snapH });
      setLive({ x, y });
    } else if (drag.kind.startsWith("resize")) {
      const edge = drag.kind.replace("resize-", "");
      let { x, y, width, height } = drag.origin;
      if (edge.includes("e")) width = clamp(drag.origin.width + dxPercent, 4, 100 - drag.origin.x);
      if (edge.includes("s")) height = clamp(drag.origin.height + dyPercent, 4, 100 - drag.origin.y);
      if (edge.includes("w")) {
        width = clamp(drag.origin.width - dxPercent, 4, drag.origin.x + drag.origin.width);
        x = drag.origin.x + drag.origin.width - width;
      }
      if (edge.includes("n")) {
        height = clamp(drag.origin.height - dyPercent, 4, drag.origin.y + drag.origin.height);
        y = drag.origin.y + drag.origin.height - height;
      }
      setLive({ x, y, width, height });
    } else if (drag.kind === "rotate") {
      const angle = Math.round((Math.atan2(event.clientY - rect.top, event.clientX - rect.left) * 180) / Math.PI) + 90;
      setLive({ rotation: ((angle % 360) + 360) % 360 });
    }
  }

  function endDrag() {
    if (drag && live) onCommit(drag.elementId, live);
    setDrag(null);
    setLive(null);
    setSnapLines({ v: false, h: false });
  }

  return (
    <div className="scena-editor__canvas-wrap">
      <div
        ref={canvasRef}
        className="scena-editor__canvas"
        style={{ width: displayWidth, height: displayHeight, background: backgroundColor }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onClick={() => onSelect(null)}
      >
        {snapLines.v && <div className="scena-editor__snap-line scena-editor__snap-line--v" style={{ left: "50%" }} />}
        {snapLines.h && <div className="scena-editor__snap-line scena-editor__snap-line--h" style={{ top: "50%" }} />}

        {[...scene.elements].sort((a, b) => a.z_index - b.z_index).map((element) => {
          const isSelected = element.id === selectedElementId;
          const applied = isSelected && drag?.elementId === element.id && live ? { ...element, ...live } : element;
          return (
            <div
              key={element.id}
              className={[
                "scena-editor__element",
                isSelected && "scena-editor__element--selected",
                element.is_locked && "scena-editor__element--locked",
                !element.is_visible && "scena-editor__element--hidden",
              ].filter(Boolean).join(" ")}
              style={{
                left: `${applied.x}%`,
                top: `${applied.y}%`,
                width: `${applied.width}%`,
                height: `${applied.height}%`,
                transform: `rotate(${applied.rotation}deg)`,
                opacity: applied.opacity,
                zIndex: element.z_index,
              }}
              onPointerDown={(event) => beginDrag("move", element, event)}
              // pointerdown's stopPropagation doesn't cover the separate
              // click event, which would bubble to the canvas's
              // deselect-on-click and instantly undo the selection.
              onClick={(event) => event.stopPropagation()}
            >
              <div className="scena-editor__element-body" style={{ background: elementColor(element) }}>
                {elementLabel(element)}
              </div>
              {isSelected && !element.is_locked && (
                <>
                  <span className="scena-editor__handle scena-editor__handle--nw" onPointerDown={(event) => beginDrag("resize-nw", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--ne" onPointerDown={(event) => beginDrag("resize-ne", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--sw" onPointerDown={(event) => beginDrag("resize-sw", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--se" onPointerDown={(event) => beginDrag("resize-se", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--rotate" onPointerDown={(event) => beginDrag("rotate", element, event)} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function elementColor(element: SceneElement): string {
  if (element.element_type === "shape") return "rgba(91,124,250,.35)";
  if (element.element_type === "image" || element.element_type === "asset_page") return "rgba(126,179,255,.16)";
  return "rgba(255,255,255,.06)";
}

function elementLabel(element: SceneElement): string {
  if (element.element_type === "text") return (element.config as { text?: string })?.text ?? "Text";
  return element.name ?? element.element_type.replace(/_/g, " ");
}
