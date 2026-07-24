// Drawer panel contents for the editor's left rail. All presentational:
// data arrives via props (the real page fetches Assets; the /dev/editor
// preview passes an empty list), so these can render without auth.
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  TextT, ImageSquare, Shapes, FileText, QrCode, Clock, CalendarBlank, Timer,
  Megaphone, MusicNotes, VideoCamera, CloudSun, TextAa, Rows, Crown, Smiley,
  MagnifyingGlass, FilmStrip,
} from "@phosphor-icons/react";
import { SCENA_UI_API_CAPABILITIES } from "../../services/scena-api/capabilities";
import type { AssetSummary } from "../../services/scena-api/assets";
import type { ElementType, ShapeVariant } from "../../services/scena-api/boards";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { SHAPE_VARIANTS, SHAPE_VARIANT_ICONS, SHAPE_VARIANT_LABELS } from "./shapeVariants";

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
  /** The single "Shape" tile is a sub-palette — one tile per variant,
   * each inserting a shape preset with that variant set. */
  onAddShape: (variant: ShapeVariant) => void;
  onAddLibraryAsset?: (type: "image" | "text", config: Record<string, unknown>) => void;
}

export function ElementsGridPanel({ onAddElement, onAddShape, onAddLibraryAsset = () => {} }: ElementsGridPanelProps) {
  // "shape" gets its own sub-palette below instead of a single generic tile.
  const staticTypes = SCENA_UI_API_CAPABILITIES.elements.static.filter((type) => type !== "shape");
  return (
    <div>
      <h4 className="scena-editor__drawer-section-title">Static</h4>
      <div className="scena-editor__element-grid">
        {staticTypes.map((type) => (
          <button key={type} type="button" className="scena-editor__element-tile" onClick={() => onAddElement(type)}>
            {ELEMENT_ICONS[type]}
            <span>{ELEMENT_LABELS[type]}</span>
          </button>
        ))}
      </div>

      <h4 className="scena-editor__drawer-section-title" style={{ marginTop: 16 }}>Shapes</h4>
      <div className="scena-editor__element-grid" role="group" aria-label="Insert a shape">
        {SHAPE_VARIANTS.map((variant) => (
          <button
            key={variant}
            type="button"
            className="scena-editor__element-tile"
            onClick={() => onAddShape(variant)}
          >
            {SHAPE_VARIANT_ICONS[variant]}
            <span>{SHAPE_VARIANT_LABELS[variant]}</span>
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

      <LibraryPanel onAddLibraryAsset={onAddLibraryAsset} />
    </div>
  );
}

const LOCAL_EMOJI = ["😀", "🎉", "❤️", "⭐", "👍", "🔥", "🌈", "🎵", "☀️", "✅", "📣", "✨"];

const LOCAL_GIF_LIBRARY = [
  { id: "sparkle", label: "Sparkle", colors: ["#7c3aed", "#22d3ee"] },
  { id: "celebrate", label: "Celebrate", colors: ["#f97316", "#ec4899"] },
  { id: "pulse", label: "Pulse", colors: ["#2563eb", "#14b8a6"] },
  { id: "sunrise", label: "Sunrise", colors: ["#f59e0b", "#ef4444"] },
];

function localLibraryImage(colors: string[]): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="320" height="180" rx="18" fill="url(#g)"/><circle cx="82" cy="90" r="28" fill="rgba(255,255,255,.65)"/><circle cx="160" cy="90" r="44" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="7"/><circle cx="246" cy="90" r="22" fill="rgba(255,255,255,.5)"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function LibraryPanel({ onAddLibraryAsset = () => {} }: Pick<ElementsGridPanelProps, "onAddLibraryAsset">) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const gifs = LOCAL_GIF_LIBRARY.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
  return (
    <section className="scena-editor__library" aria-label="Emoji and GIF library">
      <h4 className="scena-editor__drawer-section-title">Library</h4>
      <label className="scena-editor__library-search">
        <MagnifyingGlass size={16} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search emoji or GIFs" aria-label="Search emoji or GIFs" />
      </label>
      <div className="scena-editor__library-heading"><span><Smiley size={16} /> Emoji</span><small>Local</small></div>
      <div className="scena-editor__emoji-grid">
        {LOCAL_EMOJI.map((emoji) => <button key={emoji} type="button" className="scena-editor__emoji-tile" onClick={() => onAddLibraryAsset("text", { text: emoji })} aria-label={`Insert ${emoji}`}>{emoji}</button>)}
      </div>
      <div className="scena-editor__library-heading"><span><FilmStrip size={16} /> GIFs</span><small>Local library</small></div>
      <div className="scena-editor__gif-grid">
        {gifs.map((item) => <button key={item.id} type="button" className="scena-editor__gif-tile" onClick={() => onAddLibraryAsset("image", { src: localLibraryImage(item.colors), alt: item.label })}>
          <img src={localLibraryImage(item.colors)} alt="" /><span>{item.label}</span>
        </button>)}
      </div>
      {gifs.length === 0 && <p className="scena-editor__library-empty">No local GIFs match that search.</p>}
    </section>
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
  previewUrls?: ReadonlyMap<string, string>;
}

export function UploadsPanel({ assets, previewUrls, onInsertAsset }: UploadsPanelProps) {
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
        <button key={asset.id} type="button" className="scena-editor__asset-tile" onClick={() => onInsertAsset(asset.id)}>
          {previewUrls?.get(asset.id) ? <img src={previewUrls.get(asset.id)} alt="" /> : <span className="scena-editor__asset-tile-fallback"><ImageSquare size={18} /></span>}
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
