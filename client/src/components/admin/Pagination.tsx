import { BrutalButton } from '../brutal/BrutalButton.js';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Minimal brutalist pager — `< PREV` / `PAGE x OF y` / `NEXT >`. Hidden when
 * a single page would render to keep table footers visually quiet.
 */
export const Pagination = ({
  page,
  totalPages,
  onChange,
  disabled = false,
  className = '',
}: PaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-center gap-3 font-mono ${className}`}
    >
      <BrutalButton
        variant="outline"
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        {'< PREV'}
      </BrutalButton>
      <span className="px-2 text-sm uppercase tracking-widest tabular-nums">
        PAGE {page} / {totalPages}
      </span>
      <BrutalButton
        variant="outline"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        {'NEXT >'}
      </BrutalButton>
    </nav>
  );
};

export default Pagination;
