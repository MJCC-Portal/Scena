import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";
import { cx } from "./cx";

export type ToastTone = "success" | "danger" | "info";

interface ToastEntry {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle size={18} weight="fill" style={{ color: "var(--scena-success)" }} />,
  danger: <WarningCircle size={18} weight="fill" style={{ color: "var(--scena-danger)" }} />,
  info: <Info size={18} weight="fill" style={{ color: "var(--scena-info)" }} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="scena-toast-region">
          {toasts.map((toast) => (
            <div key={toast.id} className={cx("scena-toast", "scena-glass-medium")} role="status">
              {TONE_ICON[toast.tone]}
              {toast.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
