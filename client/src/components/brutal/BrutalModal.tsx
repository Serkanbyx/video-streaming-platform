import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type BrutalModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const BrutalModal = ({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  size = 'md',
}: BrutalModalProps) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    queueMicrotask(() => {
      dialogRef.current?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/70"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${SIZE_CLASS[size]} bg-bone text-ink dark:bg-ink dark:text-bone border-4 border-ink shadow-[var(--shadow-brutal)] outline-none`}
      >
        <header className="flex items-center justify-between gap-4 border-b-2 border-ink px-4 py-2 bg-acid text-ink">
          <h2
            id={titleId}
            className="font-mono uppercase tracking-tight text-sm m-0"
          >
            // {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="font-mono uppercase text-sm border-2 border-ink px-2 leading-none hover:bg-ink hover:text-acid"
          >
            [ X ]
          </button>
        </header>

        <div className="p-4 font-mono text-sm">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t-2 border-ink px-4 py-3 bg-bone dark:bg-ink/80">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
};

export default BrutalModal;
