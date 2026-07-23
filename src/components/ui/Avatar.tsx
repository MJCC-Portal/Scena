import { cx } from "./cx";

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  return (
    <span className={cx("scena-avatar", `scena-avatar--${size}`, className)}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}
