// Minimal, truthful placeholder for routes that exist (deep-linkable,
// refresh-safe, reachable from navigation) but whose page body belongs to
// the upcoming manager UI phase. Never fabricates data or actions.

import { Link } from "react-router-dom";

export function PlaceholderPage({ title, note }: { title: string; note?: string }) {
  return (
    <section>
      <div className="view-head">
        <h1>{title}</h1>
        <p>This page is routing infrastructure only — it is not implemented yet. It belongs to the upcoming manager UI phase.</p>
      </div>
      {note && <p className="muted">{note}</p>}
      <p><Link to="/app/home">Back to home</Link></p>
    </section>
  );
}
