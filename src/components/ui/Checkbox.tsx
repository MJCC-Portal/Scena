import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

interface ToggleFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export function Checkbox({ label, className, ...rest }: ToggleFieldProps) {
  return (
    <label className={cx("scena-checkbox", className)}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

export function Radio({ label, className, ...rest }: ToggleFieldProps) {
  return (
    <label className={cx("scena-radio", className)}>
      <input type="radio" {...rest} />
      {label}
    </label>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="scena-switch"
      data-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="scena-switch__thumb" />
    </button>
  );
}
