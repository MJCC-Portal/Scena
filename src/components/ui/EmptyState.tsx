import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="scena-empty">
      {icon && <div className="scena-empty__icon">{icon}</div>}
      <h2 className="scena-empty__title">{title}</h2>
      {description && <p className="scena-empty__desc">{description}</p>}
      {action}
    </div>
  );
}
