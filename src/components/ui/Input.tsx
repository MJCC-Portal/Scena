import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { cx } from "./cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ error, className, ...rest }, ref) {
  return <input ref={ref} className={cx("scena-input", error && "scena-input--error", className)} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx("scena-textarea", error && "scena-textarea--error", className)} {...rest} />;
});

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  uiSize?: "md" | "lg";
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { uiSize = "md", className, ...rest },
  ref,
) {
  return (
    <div className={cx("scena-search", uiSize === "lg" && "scena-search--lg", className)}>
      <MagnifyingGlass size={18} />
      <input ref={ref} type="search" className="scena-input" {...rest} />
    </div>
  );
});
