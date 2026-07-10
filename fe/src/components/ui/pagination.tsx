'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  // Build page list: always show first, last, current ±1, with ellipsis
  const buildPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };

    add(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
    if (page < totalPages - 2) pages.push('...');
    add(totalPages);
    return pages;
  };

  const pages = buildPages();

  const btnBase =
    'min-w-[30px] h-[30px] px-1 rounded-lg text-xs font-medium transition-all flex items-center justify-center';
  const btnActive =
    'bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_2px_8px_rgba(26,86,219,0.4)]';
  const btnIdle =
    'text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] hover:border-[rgba(26,86,219,0.4)] hover:bg-[rgba(26,86,219,0.08)]';
  const btnDisabled =
    'text-[#334155] border border-[rgba(255,255,255,0.04)] cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
      {/* Left: summary + page size */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[#64748b]">
          {from}–{to} / <span className="text-[#94a3b8] font-medium">{totalItems}</span> bản ghi
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            className="px-2 py-1 rounded-md bg-[#263147] border border-[rgba(255,255,255,0.08)] text-[11px] text-[#94a3b8] outline-none cursor-pointer hover:border-[rgba(26,86,219,0.4)] transition-colors"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} / trang</option>
            ))}
          </select>
        )}
      </div>

      {/* Right: page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Prev */}
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${btnBase} ${page === 1 ? btnDisabled : btnIdle} cursor-pointer`}
            aria-label="Trang trước"
          >
            ‹
          </button>

          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="min-w-[30px] h-[30px] flex items-center justify-center text-[#64748b] text-xs">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={`${btnBase} ${p === page ? btnActive : btnIdle} cursor-pointer`}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${btnBase} ${page === totalPages ? btnDisabled : btnIdle} cursor-pointer`}
            aria-label="Trang sau"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
