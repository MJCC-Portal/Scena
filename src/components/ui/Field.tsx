import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cx } from "./cx";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cx("scena-field", className)}>
      {label && (
        <label className="scena-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="scena-field__error" role="alert">
          <WarningCircle size={14} weight="fill" />
          {error}
        </span>
      ) : hint ? (
        <span className="scena-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
