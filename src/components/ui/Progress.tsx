import { cx } from "./cx";

export function Progress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cx("scena-progress", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="scena-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return <div className={cx("scena-spinner", className)} role="status" aria-label={label} />;
}
