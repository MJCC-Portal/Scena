// Shared shape-variant metadata (icon + accessible label) consumed by both
// the Elements drawer's shape sub-palette (EditorPanels.tsx) and the
// PropertiesPanel's shape-variant picker, so the two stay in lockstep.
import type { ReactNode } from "react";
import { Square, Circle, Triangle, Diamond, Hexagon, Star, LineSegment, ArrowRight } from "@phosphor-icons/react";
import type { ShapeVariant } from "../../services/scena-api/boards";
import { SHAPE_VARIANTS } from "../../services/scena-api/boards";

export { SHAPE_VARIANTS };
export type { ShapeVariant };

export const SHAPE_VARIANT_LABELS: Record<ShapeVariant, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  hexagon: "Hexagon",
  star: "Star",
  line: "Line",
  arrow: "Arrow",
};

export const SHAPE_VARIANT_ICONS: Record<ShapeVariant, ReactNode> = {
  rectangle: <Square size={18} />,
  ellipse: <Circle size={18} />,
  triangle: <Triangle size={18} />,
  diamond: <Diamond size={18} />,
  hexagon: <Hexagon size={18} />,
  star: <Star size={18} />,
  line: <LineSegment size={18} />,
  arrow: <ArrowRight size={18} />,
};

/** Insert-time default config per shape variant. Every variant is a
 * renderable, visible default — the "line" variant in particular needs a
 * non-zero border_width or it would insert invisible (border_width 0 is
 * the explicit borderless state everywhere else). */
export const SHAPE_VARIANT_PRESETS: Record<ShapeVariant, Record<string, unknown>> = {
  rectangle: { variant: "rectangle", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
  ellipse: { variant: "ellipse", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
  triangle: { variant: "triangle", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
  diamond: { variant: "diamond", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
  hexagon: { variant: "hexagon", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
  star: { variant: "star", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
  line: { variant: "line", fill: "#5b7cfa", fill_opacity: 1, border_width: 3, border_color: "#5b7cfa", border_style: "solid", corner_radius: 0 },
  arrow: { variant: "arrow", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 },
};

/** Insert-time footprint per shape variant. Line/arrow read poorly in a
 * square box, so they get a wider default than the rest. */
export const SHAPE_VARIANT_SIZE: Record<ShapeVariant, { width: number; height: number }> = {
  rectangle: { width: 20, height: 20 },
  ellipse: { width: 20, height: 20 },
  triangle: { width: 20, height: 20 },
  diamond: { width: 20, height: 20 },
  hexagon: { width: 20, height: 20 },
  star: { width: 20, height: 20 },
  line: { width: 30, height: 4 },
  arrow: { width: 25, height: 12 },
};
