import { cx } from "./cx";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  circle?: boolean;
  className?: string;
}

export function Skeleton({ width = "100%", height = 16, radius, circle, className }: SkeletonProps) {
  return (
    <span
      className={cx("scena-skeleton", className)}
      style={{
        display: "block",
        width,
        height,
        borderRadius: circle ? "50%" : radius,
      }}
    />
  );
}
