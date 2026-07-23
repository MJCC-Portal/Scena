import { Eye, EyeSlash, LockSimple, LockSimpleOpen, ArrowUp, ArrowDown, Trash } from "@phosphor-icons/react";
import type { SceneElement } from "../../services/scena-api/boards";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

export interface PropertiesPanelProps {
  element: SceneElement | null;
  onChange: (patch: Partial<SceneElement>) => void;
  onDelete: () => void;
  onLayerMove: (direction: "up" | "down") => void;
}

export function PropertiesPanel({ element, onChange, onDelete, onLayerMove }: PropertiesPanelProps) {
  if (!element) {
    return (
      <div className="scena-editor__properties">
        <EmptyState title="Nothing selected" description="Select an Element on the canvas to edit its properties." />
      </div>
    );
  }

  const config = (element.config ?? {}) as Record<string, unknown>;

  return (
    <div className="scena-editor__properties">
      <div className="scena-editor__prop-group">
        <h4>Position &amp; size</h4>
        <div className="scena-editor__prop-row">
          <Field label="X %"><Input type="number" value={round(element.x)} onChange={(event) => onChange({ x: Number(event.target.value) })} /></Field>
          <Field label="Y %"><Input type="number" value={round(element.y)} onChange={(event) => onChange({ y: Number(event.target.value) })} /></Field>
        </div>
        <div className="scena-editor__prop-row">
          <Field label="Width %"><Input type="number" value={round(element.width)} onChange={(event) => onChange({ width: Number(event.target.value) })} /></Field>
          <Field label="Height %"><Input type="number" value={round(element.height)} onChange={(event) => onChange({ height: Number(event.target.value) })} /></Field>
        </div>
        <div className="scena-editor__prop-row">
          <Field label="Rotation °"><Input type="number" value={round(element.rotation)} onChange={(event) => onChange({ rotation: Number(event.target.value) })} /></Field>
          <Field label="Opacity"><Input type="number" min={0} max={1} step={0.1} value={element.opacity} onChange={(event) => onChange({ opacity: Number(event.target.value) })} /></Field>
        </div>
      </div>

      <div className="scena-editor__prop-group">
        <h4>Layer &amp; state</h4>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <IconButton icon={<ArrowUp size={16} />} label="Move layer up" size="sm" onClick={() => onLayerMove("up")} />
          <IconButton icon={<ArrowDown size={16} />} label="Move layer down" size="sm" onClick={() => onLayerMove("down")} />
          <IconButton
            icon={element.is_visible ? <Eye size={16} /> : <EyeSlash size={16} />}
            label={element.is_visible ? "Hide element" : "Show element"}
            size="sm"
            onClick={() => onChange({ is_visible: !element.is_visible })}
          />
          <IconButton
            icon={element.is_locked ? <LockSimple size={16} /> : <LockSimpleOpen size={16} />}
            label={element.is_locked ? "Unlock element" : "Lock element"}
            size="sm"
            onClick={() => onChange({ is_locked: !element.is_locked })}
          />
          <IconButton icon={<Trash size={16} />} label="Delete element" size="sm" onClick={onDelete} />
        </div>
      </div>

      {element.element_type === "text" && (
        <div className="scena-editor__prop-group">
          <h4>Text</h4>
          <Field label="Content">
            <Input
              value={(config.text as string) ?? ""}
              onChange={(event) => onChange({ config: { ...config, text: event.target.value } })}
            />
          </Field>
        </div>
      )}

      {element.element_type === "shape" && (
        <div className="scena-editor__prop-group">
          <h4>Shape</h4>
          <Field label="Fill color">
            <input
              type="color"
              value={(config.fill as string) ?? "#5b7cfa"}
              onChange={(event) => onChange({ config: { ...config, fill: event.target.value } })}
              style={{ width: 40, height: 32, border: "none", borderRadius: "var(--scena-radius-sm)", cursor: "pointer" }}
            />
          </Field>
        </div>
      )}

      {element.element_type === "countdown" && (
        <div className="scena-editor__prop-group">
          <h4>Countdown</h4>
          <Field label="Target date/time" hint="ISO date-time the countdown ends at.">
            <Input
              type="datetime-local"
              value={(config.target as string) ?? ""}
              onChange={(event) => onChange({ config: { ...config, target: event.target.value } })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
