import { useState } from "react";
import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

export interface AccordionItemDef {
  key: string;
  question: ReactNode;
  answer: ReactNode;
}

export function Accordion({ items, allowMultiple = false }: { items: AccordionItemDef[]; allowMultiple?: boolean }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = allowMultiple ? new Set(prev) : new Set<string>();
      if (prev.has(key)) {
        if (allowMultiple) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div>
      {items.map((item) => {
        const open = openKeys.has(item.key);
        return (
          <div className="scena-accordion__item" key={item.key}>
            <button
              type="button"
              className="scena-accordion__trigger"
              aria-expanded={open}
              onClick={() => toggle(item.key)}
            >
              {item.question}
              <CaretDown size={16} className="scena-accordion__icon" data-open={open} />
            </button>
            {open && <div className="scena-accordion__panel">{item.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}
