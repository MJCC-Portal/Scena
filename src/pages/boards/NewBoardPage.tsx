import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBoard } from "../../services/scena-api/boards";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

const PRESETS = [
  { key: "landscape", label: "Blank", width: 1920, height: 1080, ratio: "16 / 9" },
  { key: "portrait", label: "Portrait", width: 1080, height: 1920, ratio: "9 / 16" },
  { key: "square", label: "Square", width: 1080, height: 1080, ratio: "1 / 1" },
  { key: "custom", label: "Custom", width: 1920, height: 1080, ratio: "16 / 9" },
];

export function NewBoardPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [presetKey, setPresetKey] = useState("landscape");
  const [name, setName] = useState("Untitled Board");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [background, setBackground] = useState("#000000");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const preset = PRESETS.find((item) => item.key === presetKey) ?? PRESETS[0];
  const isCustom = presetKey === "custom";

  function selectPreset(key: string) {
    setPresetKey(key);
    const found = PRESETS.find((item) => item.key === key);
    if (found && key !== "custom") {
      setWidth(found.width);
      setHeight(found.height);
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createBoard({
        workspaceId: context.workspace.id,
        name: name.trim() || "Untitled Board",
        canvasWidth: width,
        canvasHeight: height,
        backgroundColor: background,
      });
      navigate(`/app/boards/${result.board.id}`);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="scena-page scena-container-narrow">
      <PageHeader title="Create a Board" description="Choose a starting canvas size — you can change this later." />

      {error ? <div style={{ marginBottom: 20 }}><ErrorBanner error={error} /></div> : null}

      <Card style={{ marginBottom: 24 }}>
        <Field label="Board name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Untitled Board" />
        </Field>
      </Card>

      <div className="scena-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        {PRESETS.map((item) => (
          <Card
            key={item.key}
            interactive
            selected={presetKey === item.key}
            onClick={() => selectPreset(item.key)}
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            <div
              style={{
                aspectRatio: item.ratio,
                background: "var(--scena-surface-3)",
                borderRadius: "var(--scena-radius-sm)",
                margin: "0 auto 10px",
                width: item.key === "portrait" ? 40 : 64,
              }}
            />
            <div style={{ fontSize: "var(--scena-text-sm)", fontWeight: 600 }}>{item.label}</div>
          </Card>
        ))}
      </div>

      {isCustom && (
        <Card style={{ marginBottom: 24, display: "flex", gap: 16 }}>
          <Field label="Width (px)">
            <Input type="number" min={64} max={7680} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </Field>
          <Field label="Height (px)">
            <Input type="number" min={64} max={7680} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </Field>
        </Card>
      )}

      <Card style={{ marginBottom: 24 }}>
        <Field label="Background color">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="color"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              style={{ width: 40, height: 40, border: "none", borderRadius: "var(--scena-radius-sm)", background: "none", cursor: "pointer" }}
            />
            <Input value={background} onChange={(event) => setBackground(event.target.value)} style={{ maxWidth: 140 }} />
          </div>
        </Field>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <Button variant="ghost" onClick={() => navigate("/app/boards")}>Cancel</Button>
        <Button variant="primary" loading={submitting} onClick={handleCreate}>
          Create Board ({preset.width} × {preset.height})
        </Button>
      </div>
    </div>
  );
}
