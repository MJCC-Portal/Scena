import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, block = false, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "scena-btn",
        `scena-btn--${variant}`,
        size !== "md" && `scena-btn--${size}`,
        block && "scena-btn--block",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <CircleNotch size={16} className="scena-spinner-icon" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  size?: "sm" | "md";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = "md", active = false, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx("scena-icon-btn", size === "sm" && "scena-icon-btn--sm", active && "scena-icon-btn--active", className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {icon}
    </button>
  );
});

export function ButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("scena-btn-group", className)}>{children}</div>;
}
