import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface MenuItemDef {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: MenuItemDef[];
  align?: "left" | "right";
}

/** Click-outside + Escape to close; returns focus to the trigger on close. */
export function DropdownMenu({ trigger, items, align = "right" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="scena-menu-wrap" ref={wrapRef}>
      <span
        ref={triggerRef}
        tabIndex={-1}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: "inline-flex" }}
      >
        {trigger}
      </span>
      {open && (
        <div
          className={cx("scena-menu-popover", align === "left" && "scena-menu-popover--left")}
          style={align === "left" ? { right: "auto", left: 0 } : undefined}
        >
          <div className="scena-menu scena-glass-medium" role="menu">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cx("scena-menu__item", item.danger && "scena-menu__item--danger")}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
                {item.shortcut && <span className="scena-menu__shortcut">{item.shortcut}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="scena-menu__separator" />;
}
