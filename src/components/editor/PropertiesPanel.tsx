import type { ReactNode } from "react";
import { Eye, EyeSlash, LockSimple, LockSimpleOpen, ArrowUp, ArrowDown, Trash } from "@phosphor-icons/react";
import type { SceneElement, BorderStyle } from "../../services/scena-api/boards";
import { readBorderConfig, readShapeConfig } from "../../services/scena-api/boards";
import { Field } from "../ui/Field";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SHAPE_VARIANTS, SHAPE_VARIANT_ICONS, SHAPE_VARIANT_LABELS } from "./shapeVariants";

const BORDER_STYLE_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

type ConfigurableElementType =
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

const CONFIG_DEFAULTS: Record<ConfigurableElementType, Record<string, unknown>> = {
  clock: { format: "HH:mm", timezone: "local" },
  date: { format: "MMM d, yyyy", timezone: "local" },
  countdown: { target: "", format: "days_hours_minutes" },
  qr_static: { value: "" },
  qr_dynamic: { target: "" },
  music_player: { url: "", title: "", autoplay: false },
  ticker: { items: [], speed: 40, direction: "left" },
  carousel: { items: [], interval: 5, autoplay: true },
  video: { url: "", autoplay: false, muted: true, loop: true },
  weather: { location: "", latitude: "", longitude: "", units: "fahrenheit", format: "current" },
  data_text: { key: "", fallback: "", format: "text" },
};

/** Returns stable, UI-friendly defaults without changing the saved config. */
export function normalizeElementConfig(
  elementType: ConfigurableElementType,
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return { ...CONFIG_DEFAULTS[elementType], ...(config ?? {}) };
}

function isConfigurableElementType(value: SceneElement["element_type"]): value is ConfigurableElementType {
  return value in CONFIG_DEFAULTS;
}

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

  const config = isConfigurableElementType(element.element_type)
    ? normalizeElementConfig(element.element_type, element.config)
    : ((element.config ?? {}) as Record<string, unknown>);
  const updateConfig = (patch: Record<string, unknown>) => onChange({ config: { ...config, ...patch } });

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

      {(
        <div className="scena-editor__prop-group">
          <h4>Border</h4>
          <div className="scena-editor__prop-row">
            <Field label="Width"><Input type="number" min={0} max={20} step={1} value={readBorderConfig(element).border_width} onChange={(event) => updateConfig({ border_width: Number(event.target.value) })} /></Field>
            <Field label="Style"><Select aria-label="Border style" value={readBorderConfig(element).border_style} options={BORDER_STYLE_OPTIONS} onChange={(event) => updateConfig({ border_style: event.target.value })} /></Field>
          </div>
          <Field label="Color"><input type="color" value={readBorderConfig(element).border_color} onChange={(event) => updateConfig({ border_color: event.target.value })} style={{ width: 40, height: 32, border: "none", borderRadius: "var(--scena-radius-sm)", cursor: "pointer" }} /></Field>
        </div>
      )}

      {element.element_type === "clock" && (
        <div className="scena-editor__prop-group">
          <h4>Clock</h4>
          <Field label="Time format"><Select value={String(config.format)} options={[{ value: "HH:mm", label: "24-hour (14:30)" }, { value: "hh:mm A", label: "12-hour (2:30 PM)" }, { value: "HH:mm:ss", label: "24-hour with seconds" }]} onChange={(event) => updateConfig({ format: event.target.value })} /></Field>
          <Field label="Timezone" hint="Use local for the display device timezone."><Input value={String(config.timezone)} onChange={(event) => updateConfig({ timezone: event.target.value })} /></Field>
        </div>
      )}

      {element.element_type === "date" && (
        <div className="scena-editor__prop-group">
          <h4>Date</h4>
          <Field label="Date format"><Select value={String(config.format)} options={[{ value: "MMM d, yyyy", label: "Jul 23, 2026" }, { value: "MMMM d, yyyy", label: "July 23, 2026" }, { value: "dd/MM/yyyy", label: "23/07/2026" }, { value: "MM/dd/yyyy", label: "07/23/2026" }]} onChange={(event) => updateConfig({ format: event.target.value })} /></Field>
          <Field label="Timezone"><Input value={String(config.timezone)} onChange={(event) => updateConfig({ timezone: event.target.value })} /></Field>
        </div>
      )}

      {element.element_type === "countdown" && (
        <div className="scena-editor__prop-group">
          <h4>Countdown</h4>
          <Field label="Target date/time" hint="ISO date-time the countdown ends at.">
            <Input
              type="datetime-local"
              value={(config.target as string) ?? ""}
              onChange={(event) => updateConfig({ target: event.target.value })}
            />
          </Field>
          <Field label="Display format"><Select value={String(config.format)} options={[{ value: "days_hours_minutes", label: "Days, hours, minutes" }, { value: "hours_minutes_seconds", label: "Hours, minutes, seconds" }]} onChange={(event) => updateConfig({ format: event.target.value })} /></Field>
        </div>
      )}

      {element.element_type === "qr_static" && (
        <ConfigGroup title="QR code"><Field label="Text or URL" hint="The value encoded in this QR code."><Input type="text" value={String(config.value)} onChange={(event) => updateConfig({ value: event.target.value })} /></Field></ConfigGroup>
      )}

      {element.element_type === "qr_dynamic" && (
        <ConfigGroup title="Dynamic QR code"><Field label="Target URL" hint="The destination encoded when the display renders the code."><Input type="url" value={String(config.target)} onChange={(event) => updateConfig({ target: event.target.value })} /></Field></ConfigGroup>
      )}

      {element.element_type === "music_player" && (
        <ConfigGroup title="Music player">
          <Field label="Audio URL"><Input type="url" value={String(config.url)} onChange={(event) => updateConfig({ url: event.target.value })} /></Field>
          <Field label="Title"><Input value={String(config.title)} onChange={(event) => updateConfig({ title: event.target.value })} /></Field>
          <CheckboxField label="Autoplay" checked={Boolean(config.autoplay)} onChange={(checked) => updateConfig({ autoplay: checked })} />
        </ConfigGroup>
      )}

      {element.element_type === "ticker" && (
        <ConfigGroup title="Ticker">
          <Field label="Items" hint="One message per line."><Textarea rows={4} value={itemsToText(config.items)} onChange={(event) => updateConfig({ items: textToItems(event.target.value) })} /></Field>
          <div className="scena-editor__prop-row"><Field label="Speed"><Input type="number" min={1} value={String(config.speed)} onChange={(event) => updateConfig({ speed: Number(event.target.value) })} /></Field><Field label="Direction"><Select value={String(config.direction)} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} onChange={(event) => updateConfig({ direction: event.target.value })} /></Field></div>
        </ConfigGroup>
      )}

      {element.element_type === "carousel" && (
        <ConfigGroup title="Carousel">
          <Field label="Items" hint="One image URL or asset reference per line."><Textarea rows={4} value={itemsToText(config.items)} onChange={(event) => updateConfig({ items: textToItems(event.target.value) })} /></Field>
          <Field label="Seconds per item"><Input type="number" min={1} value={String(config.interval)} onChange={(event) => updateConfig({ interval: Number(event.target.value) })} /></Field>
          <CheckboxField label="Autoplay" checked={Boolean(config.autoplay)} onChange={(checked) => updateConfig({ autoplay: checked })} />
        </ConfigGroup>
      )}

      {element.element_type === "video" && (
        <ConfigGroup title="Video">
          <Field label="Video URL"><Input type="url" value={String(config.url)} onChange={(event) => updateConfig({ url: event.target.value })} /></Field>
          <CheckboxField label="Autoplay" checked={Boolean(config.autoplay)} onChange={(checked) => updateConfig({ autoplay: checked })} />
          <CheckboxField label="Muted" checked={Boolean(config.muted)} onChange={(checked) => updateConfig({ muted: checked })} />
          <CheckboxField label="Loop" checked={Boolean(config.loop)} onChange={(checked) => updateConfig({ loop: checked })} />
        </ConfigGroup>
      )}

      {element.element_type === "weather" && (
        <ConfigGroup title="Weather">
          <Field label="Location" hint="City, region, or postal code."><Input value={String(config.location)} onChange={(event) => updateConfig({ location: event.target.value })} /></Field>
          <Field label="Latitude" hint="Required for live weather. Example: 40.7128"><Input inputMode="decimal" value={String(config.latitude)} onChange={(event) => updateConfig({ latitude: event.target.value })} /></Field>
          <Field label="Longitude" hint="Required for live weather. Example: -74.0060"><Input inputMode="decimal" value={String(config.longitude)} onChange={(event) => updateConfig({ longitude: event.target.value })} /></Field>
          <Field label="Units"><Select value={String(config.units)} options={[{ value: "fahrenheit", label: "Fahrenheit" }, { value: "celsius", label: "Celsius" }]} onChange={(event) => updateConfig({ units: event.target.value })} /></Field>
          <Field label="Display format"><Select value={String(config.format)} options={[{ value: "current", label: "Current conditions" }, { value: "current_forecast", label: "Current + forecast" }]} onChange={(event) => updateConfig({ format: event.target.value })} /></Field>
        </ConfigGroup>
      )}

      {element.element_type === "data_text" && (
        <ConfigGroup title="Live data text">
          <Field label="Data key" hint="A key supplied by the display data context, not a network endpoint."><Input value={String(config.key)} onChange={(event) => updateConfig({ key: event.target.value })} /></Field>
          <Field label="Fallback text"><Input value={String(config.fallback)} onChange={(event) => updateConfig({ fallback: event.target.value })} /></Field>
          <Field label="Format"><Input value={String(config.format)} onChange={(event) => updateConfig({ format: event.target.value })} /></Field>
        </ConfigGroup>
      )}
    </div>
  );
}

function ConfigGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="scena-editor__prop-group"><h4>{title}</h4>{children}</div>;
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function itemsToText(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

function textToItems(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
