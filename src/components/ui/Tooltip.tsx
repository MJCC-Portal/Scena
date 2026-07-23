import type { ReactNode } from "react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="scena-tooltip-wrap">
      {children}
      <span className="scena-tooltip scena-glass-medium" role="tooltip">
        {label}
      </span>
    </span>
  );
}
