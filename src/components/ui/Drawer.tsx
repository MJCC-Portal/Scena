import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { IconButton } from "./Button";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // See Modal.tsx for why onClose is read via a ref rather than depended on
  // directly — an inline caller callback would otherwise re-run this effect
  // (and re-capture previouslyFocused) on every unrelated parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const node = drawerRef.current;
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
    <>
      <div className="scena-drawer-overlay" onClick={onClose} />
      <div ref={drawerRef} className="scena-drawer scena-glass-strong" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          {title && <h2 className="scena-modal__title" style={{ marginBottom: 0 }}>{title}</h2>}
          <IconButton icon={<X size={18} />} label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
