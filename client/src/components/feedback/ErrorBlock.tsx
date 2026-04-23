import { BrutalButton } from '../brutal/BrutalButton.js';

interface ErrorBlockProps {
  message: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBlock = ({
  message,
  requestId,
  onRetry,
  className = '',
}: ErrorBlockProps) => (
  <div
    role="alert"
    className={`mx-auto flex w-full max-w-xl flex-col items-start gap-3 border-2 border-orange bg-bone p-4 font-mono text-ink shadow-[var(--shadow-brutal)] dark:bg-ink dark:text-bone ${className}`}
  >
    <header className="flex w-full items-center justify-between">
      <span className="bg-orange px-2 py-0.5 text-xs uppercase tracking-widest text-ink">
        // ERROR //
      </span>
      {requestId && (
        <span className="text-[10px] uppercase opacity-60">
          // REF: {requestId}
        </span>
      )}
    </header>

    <p className="text-sm">{message}</p>

    {onRetry && (
      <BrutalButton variant="outline" size="sm" onClick={onRetry}>
        RETRY
      </BrutalButton>
    )}
  </div>
);

export default ErrorBlock;
