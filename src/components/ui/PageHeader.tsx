import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="scena-page-header">
      <div>
        <h1 className="scena-page-header__title">{title}</h1>
        {description && <p className="scena-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="scena-page-header__actions">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="scena-section-header">
      <h2 className="scena-section-header__title">{title}</h2>
      {actions}
    </div>
  );
}
