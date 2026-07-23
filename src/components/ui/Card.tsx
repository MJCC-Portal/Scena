import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
}

export function Card({ interactive, selected, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx("scena-card", interactive && "scena-card--interactive", selected && "scena-card--selected", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface GridCardProps extends HTMLAttributes<HTMLDivElement> {
  thumb?: ReactNode;
  title: string;
  meta?: ReactNode;
  interactive?: boolean;
  selected?: boolean;
}

export function GridCard({ thumb, title, meta, interactive = true, selected, className, children, ...rest }: GridCardProps) {
  return (
    <Card interactive={interactive} selected={selected} className={cx("scena-grid-card", className)} {...rest}>
      {thumb && <div className="scena-grid-card__thumb">{thumb}</div>}
      <div className="scena-grid-card__title">{title}</div>
      {meta && <div className="scena-grid-card__meta">{meta}</div>}
      {children}
    </Card>
  );
}

export function Grid({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("scena-grid", className)} {...rest}>
      {children}
    </div>
  );
}
