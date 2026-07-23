// Minimal, truthful placeholder for routes that exist (deep-linkable,
// refresh-safe, reachable from navigation) but whose page body belongs to
// the upcoming manager UI phase. Never fabricates data or actions.

import { Link } from "react-router-dom";
import { Wrench } from "@phosphor-icons/react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { ScenaMark } from "../../components/brand/ScenaMark";

export function PlaceholderPage({ title, note }: { title: string; note?: string }) {
  return (
    <div className="scena-page" style={{ position: "relative", overflow: "hidden" }}>
      <span className="scena-void__petal" aria-hidden="true" style={{ top: "16%", left: "8%", opacity: 0.3, ["--petal-duration" as string]: "13s" }}>
        <ScenaMark size={36} color="var(--scena-brand)" />
      </span>
      <span className="scena-void__petal" aria-hidden="true" style={{ top: "62%", left: "86%", opacity: 0.4, ["--petal-duration" as string]: "9s" }}>
        <ScenaMark size={22} color="var(--scena-brand)" />
      </span>
      <EmptyState
        icon={<Wrench size={32} />}
        title={title}
        description="This page is routing infrastructure only — it is not implemented yet. It belongs to the upcoming manager UI phase."
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {note && <p style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)", maxWidth: 420 }}>{note}</p>}
            <Link to="/app/home"><Button variant="secondary" size="sm">Back to home</Button></Link>
          </div>
        }
      />
    </div>
  );
}
