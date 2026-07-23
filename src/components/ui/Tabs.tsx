import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "./cx";

interface TabsContextValue {
  active: string;
  setActive: (key: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (key: string) => void;
  children: ReactNode;
}

export function Tabs({ defaultValue, value, onChange, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const active = value ?? internal;
  const setActive = (key: string) => {
    setInternal(key);
    onChange?.(key);
  };
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
}

export function TabList({ children }: { children: ReactNode }) {
  return (
    <div className="scena-tabs__list" role="tablist">
      {children}
    </div>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab must be used within Tabs");
  const isActive = ctx.active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className="scena-tabs__tab"
      data-active={isActive}
      onClick={() => ctx.setActive(value)}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabPanel must be used within Tabs");
  if (ctx.active !== value) return null;
  return (
    <div role="tabpanel" className={cx("scena-tabs__panel", className)}>
      {children}
    </div>
  );
}
