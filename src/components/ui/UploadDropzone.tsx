import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { UploadSimple, CheckCircle, WarningCircle, CircleNotch, FileArrowUp } from "@phosphor-icons/react";
import { cx } from "./cx";

export interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  hint?: string;
  disabled?: boolean;
}

export function UploadDropzone({ onFiles, accept, hint, disabled }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="scena-dropzone"
      data-dragging={dragging}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
    >
      <UploadSimple size={32} className="scena-dropzone__icon" />
      <div className="scena-dropzone__title">Drag files here, or click to browse</div>
      {hint && <div className="scena-dropzone__hint">{hint}</div>}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        className="scena-visually-hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export type FileQueueItemStatus = "uploading" | "processing" | "ready" | "failed";

export interface FileQueueItemDef {
  key: string;
  name: string;
  status: FileQueueItemStatus;
  statusLabel?: string;
  progress?: number;
  action?: ReactNode;
}

const STATUS_ICON: Record<FileQueueItemStatus, ReactNode> = {
  uploading: <CircleNotch size={18} className="scena-spinner-icon" style={{ color: "var(--scena-info)" }} />,
  processing: <CircleNotch size={18} className="scena-spinner-icon" style={{ color: "var(--scena-violet)" }} />,
  ready: <CheckCircle size={18} weight="fill" style={{ color: "var(--scena-success)" }} />,
  failed: <WarningCircle size={18} weight="fill" style={{ color: "var(--scena-danger)" }} />,
};

export function FileQueue({ items }: { items: FileQueueItemDef[] }) {
  if (!items.length) return null;
  return (
    <div className="scena-file-queue">
      {items.map((item) => (
        <div className="scena-file-queue-item" key={item.key}>
          {STATUS_ICON[item.status] ?? <FileArrowUp size={18} />}
          <div className="scena-file-queue-item__meta">
            <div className="scena-file-queue-item__name">{item.name}</div>
            <div className={cx("scena-file-queue-item__status")}>{item.statusLabel ?? item.status}</div>
          </div>
          {item.action}
        </div>
      ))}
    </div>
  );
}
