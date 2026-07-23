import { Fragment } from "react";
import { Link } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="scena-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <CaretRight size={12} />}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
