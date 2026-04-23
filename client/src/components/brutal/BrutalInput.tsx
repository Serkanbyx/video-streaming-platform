import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

type BrutalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label?: string;
  error?: string;
  prefix?: ReactNode;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
};

export const BrutalInput = ({
  label,
  error,
  prefix,
  hint,
  id,
  className = '',
  ref,
  ...rest
}: BrutalInputProps) => {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const borderColor = error ? 'border-orange' : 'border-ink';

  return (
    <div className="flex flex-col gap-1 font-mono">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs uppercase tracking-tight text-ink dark:text-bone"
        >
          // {label}
        </label>
      )}

      <div
        className={`flex items-stretch border-2 ${borderColor} bg-bone dark:bg-ink focus-within:shadow-(--shadow-brutal-sm)`}
      >
        {prefix !== undefined && (
          <span
            aria-hidden="true"
            className="flex items-center px-3 border-r-2 border-ink bg-ink text-acid select-none"
          >
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={`flex-1 min-w-0 px-3 py-2 bg-transparent text-ink dark:text-bone placeholder:text-ink/40 dark:placeholder:text-bone/40 outline-none ${className}`}
          {...rest}
        />
      </div>

      {hint && !error && (
        <p id={hintId} className="text-xs text-ink/60 dark:text-bone/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs uppercase text-orange">
          ! {error}
        </p>
      )}
    </div>
  );
};

export default BrutalInput;
