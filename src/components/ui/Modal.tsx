import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "md" | "lg";
  children?: ReactNode;
  footer?: ReactNode;
}

/** Focus-trapped, Escape-to-close, returns focus to the trigger on close. */
export function Modal({ open, onClose, title, description, size = "md", children, footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // A ref, not a dependency: an inline onClose from the caller gets a new
  // identity every parent render, which — if depended on directly — would
  // tear down and rebuild this effect on every such render while the modal
  // stayed open, re-capturing previouslyFocused from whatever happened to
  // have focus at that moment instead of the real trigger element.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const node = modalRef.current;
    const focusable = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="scena-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={modalRef}
        className={cx("scena-modal scena-glass-strong", size === "lg" && "scena-modal--lg")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && <h2 className="scena-modal__title">{title}</h2>}
        {description && <p className="scena-modal__desc">{description}</p>}
        {children}
        {footer && <div className="scena-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
