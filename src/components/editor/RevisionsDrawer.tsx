import { useState } from "react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import type { BoardRevision } from "../../services/scena-api/boards";

export interface RevisionsDrawerProps {
  open: boolean;
  onClose: () => void;
  revisions: BoardRevision[];
  onCreate: (label: string) => Promise<void>;
}

export function RevisionsDrawer({ open, onClose, revisions, onCreate }: RevisionsDrawerProps) {
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await onCreate(label);
      setLabel("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Revision history">
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <Field label="New revision label">
          <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Before summer refresh" />
        </Field>
      </div>
      <Button variant="primary" block loading={creating} onClick={handleCreate} style={{ marginBottom: 24 }}>
        Save current version as a revision
      </Button>

      {revisions.length === 0 ? (
        <EmptyState title="No revisions yet" description="Named revisions let you mark a version of this Board to come back to. There's no automatic restore yet — a revision records the version and date." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {revisions.map((revision) => (
            <div key={revision.id} style={{ padding: 12, border: "1px solid var(--scena-border)", borderRadius: "var(--scena-radius-md)" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--scena-text-sm)" }}>{revision.label || `Version ${revision.board_version}`}</div>
              <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                v{revision.board_version} · {new Date(revision.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
