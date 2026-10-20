import type { ReactNode } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface PaginationProps {
  /** 1-indexed. */
  page: number;
  pageSize: number;
  /** Rows across every page. */
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const ARROW_CLASS =
  "flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-tn-input-border text-tn-muted-4 hover:bg-tn-page disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Rows per page, ‹ 1 … 4 5 6 … 12 › — the footer under a paged table
 * (the appointment list, Customers). Hidden while everything fits on the
 * smallest page size, and not merely the current one, so somebody who
 * switched to 50 rows can still switch back.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  if (totalCount <= Math.min(...pageSizeOptions)) return null;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // A wall of 13+ page buttons (e.g. 248 appointments at 20/page) doesn't
  // fit — window down to page 1, the current page ± 1, and the last page,
  // with an ellipsis filling any gap.
  const keep = Array.from(
    new Set([1, page - 1, page, page + 1, totalPages].filter((n) => n >= 1 && n <= totalPages)),
  ).sort((a, b) => a - b);
  const pageButtons: ReactNode[] = [];
  keep.forEach((n, i) => {
    if (i > 0 && n - keep[i - 1]! > 1) {
      pageButtons.push(
        <span key={`gap-${n}`} className="px-0.5 font-sans text-xs text-tn-faint-2">
          …
        </span>,
      );
    }
    pageButtons.push(
      <button
        key={n}
        type="button"
        onClick={() => onPageChange(n)}
        aria-label={`Page ${n}`}
        aria-current={n === page ? "page" : undefined}
        className={`flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg font-sans text-xs font-semibold ${
          n === page
            ? "bg-tn-dark-gradient text-tn-on-dark"
            : "border border-tn-input-border text-tn-muted-4 hover:bg-tn-page"
        }`}
      >
        {n}
      </button>,
    );
  });

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-tn-border-soft pt-4"
    >
      <label className="flex items-center gap-1.5 font-sans text-[14px] text-tn-muted-5">
        Rows per page
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="cursor-pointer border-none bg-transparent font-sans text-[14px] font-semibold text-tn-ink-soft"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className={ARROW_CLASS}
        >
          ‹
        </button>
        {pageButtons}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={ARROW_CLASS}
        >
          ›
        </button>
      </div>
    </nav>
  );
}

/** "Showing 21–40 of 129 customers" — the line above a paged table. */
export function PageRange({
  page,
  pageSize,
  totalCount,
  noun,
  className = "",
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  noun: string;
  className?: string;
}) {
  const rangeStart = (page - 1) * pageSize + 1;
  // Nothing to say about an empty list, or for the moment a page is past
  // the end (the list's own effect steps back to the last real page).
  if (totalCount === 0 || rangeStart > totalCount) return null;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  return (
    <p className={`m-0 font-sans text-[14px] text-tn-muted-5 ${className}`}>
      Showing{" "}
      <span className="font-semibold text-tn-ink-soft">
        {rangeStart}–{rangeEnd}
      </span>{" "}
      of <span className="font-semibold text-tn-ink-soft">{totalCount}</span> {noun}
    </p>
  );
}
