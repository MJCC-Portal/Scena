// The Scena flower mark — six pinwheeled almond petals radiating from a
// small negative-space core, matching the brand app icons. Rendered as
// inline SVG so it inherits `currentColor` anywhere (rail, landing nav,
// auth cards) without shipping a bitmap.

const PETAL_ANGLES = [0, 60, 120, 180, 240, 300];

// One petal pointing up: outer tip near the top edge, inner tip stopping
// short of center so the six bases leave the star-shaped hole in the middle.
const PETAL_PATH = "M50 40 C40.5 31.5 38.5 13.5 51 2 C61.5 14.5 57.5 32 50 40 Z";

export interface ScenaMarkProps {
  size?: number;
  color?: string;
  title?: string;
}

export function ScenaMark({ size = 28, color = "currentColor", title }: ScenaMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <g fill={color}>
        {PETAL_ANGLES.map((angle) => (
          <path key={angle} d={PETAL_PATH} transform={`rotate(${angle + 12} 50 50)`} />
        ))}
      </g>
    </svg>
  );
}
