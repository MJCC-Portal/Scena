import type { ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "violet";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ tone = "neutral", children, dot = false, className }: BadgeProps) {
  return (
    <span className={cx("scena-badge", `scena-badge--${tone}`, className)}>
      {dot && <span className="scena-badge__dot" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  ready: "success",
  active: "success",
  online: "success",
  processing: "info",
  queued: "violet",
  draft: "violet",
  pending: "violet",
  pending_upload: "violet",
  uploaded: "violet",
  failed: "danger",
  revoked: "danger",
  suspended: "danger",
  offline: "neutral",
  archived: "neutral",
  stopped: "neutral",
  pairing: "warning",
  warning: "warning",
};

export function StatusIndicator({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge tone={tone} dot>
      {label ?? status}
    </Badge>
  );
}
