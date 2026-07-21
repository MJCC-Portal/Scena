// Raw JSON dump used across the still-minimal manager pages carried
// over from the pre-router test harness (src/App.tsx). Not a shared UI
// component in the design sense — a debugging aid, kept until the real
// manager UI replaces these pages' presentation.
export function Json({ value }: { value: unknown }) {
  return <pre style={{ background: "#111", color: "#0f0", padding: 8, overflow: "auto", maxHeight: 300, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
}
