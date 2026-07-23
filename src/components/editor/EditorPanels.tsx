// Drawer panel contents for the editor's left rail. All presentational:
// data arrives via props (the real page fetches Assets; the /dev/editor
// preview passes an empty list), so these can render without auth.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  TextT, ImageSquare, Shapes, FileText, QrCode, Clock, CalendarBlank, Timer,
  Megaphone, MusicNotes, VideoCamera, CloudSun, TextAa, Rows, Crown,
} from "@phosphor-icons/react";
import { SCENA_UI_API_CAPABILITIES } from "../../services/scena-api/capabilities";
import type { AssetSummary } from "../../services/scena-api/assets";
import type { ElementType } from "../../services/scena-api/boards";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";

/* ------------------------------------------------------------------ */
/* Elements                                                           */
/* ------------------------------------------------------------------ */

const ELEMENT_ICONS: Record<ElementType, ReactNode> = {
  text: <TextT size={20} />,
  image: <ImageSquare size={20} />,
  shape: <Shapes size={20} />,
  asset_page: <FileText size={20} />,
  qr_static: <QrCode size={20} />,
  qr_dynamic: <QrCode size={20} />,
  clock: <Clock size={20} />,
  date: <CalendarBlank size={20} />,
  countdown: <Timer size={20} />,
  ticker: <Megaphone size={20} />,
  music_player: <MusicNotes size={20} />,
  carousel: <Rows size={20} />,
  video: <VideoCamera size={20} />,
  weather: <CloudSun size={20} />,
  data_text: <TextAa size={20} />,
};

const ELEMENT_LABELS: Record<ElementType, string> = {
  text: "Text",
  image: "Image",
  shape: "Shape",
  asset_page: "Asset page",
  qr_static: "QR (static)",
  qr_dynamic: "QR (dynamic)",
  clock: "Clock",
  date: "Date",
  countdown: "Countdown",
  ticker: "Ticker",
  music_player: "Music player",
  carousel: "Carousel",
  video: "Video",
  weather: "Weather",
  data_text: "Live data text",
};

export interface ElementsGridPanelProps {
  onAddElement: (type: ElementType) => void;
}

export function ElementsGridPanel({ onAddElement }: ElementsGridPanelProps) {
  return (
    <div>
      <h4 className="scena-editor__drawer-section-title">Static</h4>
      <div className="scena-editor__element-grid">
        {SCENA_UI_API_CAPABILITIES.elements.static.map((type) => (
          <button key={type} type="button" className="scena-editor__element-tile" onClick={() => onAddElement(type)}>
            {ELEMENT_ICONS[type]}
            <span>{ELEMENT_LABELS[type]}</span>
          </button>
        ))}
      </div>
      <h4 className="scena-editor__drawer-section-title" style={{ marginTop: 16 }}>Live</h4>
      <div className="scena-editor__element-grid">
        {SCENA_UI_API_CAPABILITIES.elements.live.map((type) => (
          <button key={type} type="button" className="scena-editor__element-tile" onClick={() => onAddElement(type)}>
            {ELEMENT_ICONS[type]}
            <span>{ELEMENT_LABELS[type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text presets                                                       */
/* ------------------------------------------------------------------ */

// Only config.text is rendered/edited today (see PropertiesPanel and
// EditorCanvas), so presets differ by default content and footprint —
// no unrendered config keys are invented here.
export interface TextPresetSpec {
  id: "heading" | "subheading" | "body";
  label: string;
  text: string;
  width: number;
  height: number;
}

export const TEXT_PRESETS: TextPresetSpec[] = [
  { id: "heading", label: "Add a heading", text: "Add a heading", width: 44, height: 12 },
  { id: "subheading", label: "Add a subheading", text: "Add a subheading", width: 36, height: 8 },
  { id: "body", label: "Add a little body text", text: "Add a little body text", width: 30, height: 6 },
];

export interface TextPresetsPanelProps {
  onInsertPreset: (preset: TextPresetSpec) => void;
}

export function TextPresetsPanel({ onInsertPreset }: TextPresetsPanelProps) {
  return (
    <div className="scena-editor__text-presets">
      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`scena-editor__text-preset scena-editor__text-preset--${preset.id}`}
          onClick={() => onInsertPreset(preset)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Uploads (workspace Assets)                                         */
/* ------------------------------------------------------------------ */

export interface UploadsPanelProps {
  /** null = still loading (skeletons); [] = empty state. */
  assets: AssetSummary[] | null;
  onInsertAsset: (assetId: string) => void;
}

export function UploadsPanel({ assets, onInsertAsset }: UploadsPanelProps) {
  if (assets === null) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </div>
    );
  }
  if (assets.length === 0) {
    return <EmptyState title="No ready Assets" description="Upload an Asset first, from the Assets page." />;
  }
  return (
    <div>
      {assets.map((asset) => (
        <button key={asset.id} type="button" className="scena-editor__element-option" onClick={() => onInsertAsset(asset.id)}>
          <ImageSquare size={18} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.original_filename}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Premium upsell (Templates / Brand)                                 */
/* ------------------------------------------------------------------ */

const UPSELL_COPY: Record<"templates" | "brand", { title: string; body: string }> = {
  templates: {
    title: "Templates are a premium feature",
    body: "Ready-made Board Templates are coming to paid Workspaces.",
  },
  brand: {
    title: "Brand Kits are a premium feature",
    body: "Brand Kits — your logo, colors, and fonts in one place — are coming to paid Workspaces.",
  },
};

export interface PremiumUpsellPanelProps {
  feature: "templates" | "brand";
}

export function PremiumUpsellPanel({ feature }: PremiumUpsellPanelProps) {
  const copy = UPSELL_COPY[feature];
  return (
    <div className="scena-editor__upsell">
      <Crown size={32} weight="fill" className="scena-editor__upsell-crown" />
      <h4>{copy.title}</h4>
      <p>{copy.body}</p>
      <Link to="/app/billing" className="scena-btn scena-btn--primary scena-btn--sm">View plans</Link>
    </div>
  );
}
