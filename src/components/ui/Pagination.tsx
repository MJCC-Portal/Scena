import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { IconButton } from "./Button";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="scena-pagination">
      <IconButton
        icon={<CaretLeft size={16} />}
        label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        size="sm"
      />
      <span style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)" }}>
        Page {page} of {totalPages}
      </span>
      <IconButton
        icon={<CaretRight size={16} />}
        label="Next page"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        size="sm"
      />
    </div>
  );
}
