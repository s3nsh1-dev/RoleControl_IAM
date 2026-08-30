import type { PaginationMeta } from "../api/types";
import { Button } from "./ui";

export function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination?: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (!pagination) return null;

  return (
    <div className="pagination-bar">
      <span>
        Page {pagination.page} of {Math.max(pagination.totalPages, 1)} ·{" "}
        {pagination.total} total
      </span>
      <div className="button-row">
        <Button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          disabled={
            pagination.totalPages === 0 ||
            pagination.page >= pagination.totalPages
          }
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
