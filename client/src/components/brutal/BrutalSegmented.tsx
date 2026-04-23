import { useId, type ReactNode } from 'react';

export interface BrutalSegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
  hint?: string;
  swatch?: ReactNode;
}

interface BrutalSegmentedProps<TValue extends string> {
  label?: string;
  description?: string;
  value: TValue;
  options: readonly BrutalSegmentedOption<TValue>[];
  onChange: (next: TValue) => void;
  name?: string;
  disabled?: boolean;
}

/**
 * Brutalist segmented control. Renders a `radiogroup` with hard-edged option
 * buttons; the active option flips to the acid background. Used across
 * appearance settings (theme, font size, density, animations, accent).
 */
export const BrutalSegmented = <TValue extends string>({
  label,
  description,
  value,
  options,
  onChange,
  name,
  disabled = false,
}: BrutalSegmentedProps<TValue>) => {
  const groupId = useId();
  const groupName = name ?? `segmented-${groupId}`;
  const descriptionId = description ? `${groupId}-desc` : undefined;

  return (
    <div className="flex flex-col gap-2 font-mono">
      {label && (
        <span
          id={`${groupId}-label`}
          className="text-xs uppercase tracking-tight text-ink dark:text-bone"
        >
          // {label}
        </span>
      )}

      <div
        role="radiogroup"
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-describedby={descriptionId}
        aria-disabled={disabled || undefined}
        className="flex flex-wrap gap-0 border-2 border-ink bg-bone shadow-(--shadow-brutal-sm) dark:bg-ink"
      >
        {options.map((option, index) => {
          const isActive = option.value === value;
          const inputId = `${groupName}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={[
                'flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs uppercase tracking-tight',
                'min-w-22 cursor-pointer select-none border-ink',
                index > 0 ? 'border-l-2' : '',
                isActive
                  ? 'bg-acid text-ink'
                  : 'text-ink hover:bg-ink/10 dark:text-bone dark:hover:bg-bone/10',
                disabled ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              <input
                id={inputId}
                type="radio"
                name={groupName}
                value={option.value}
                checked={isActive}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.swatch && (
                <span aria-hidden="true" className="inline-flex">
                  {option.swatch}
                </span>
              )}
              <span aria-hidden="true">[</span>
              <span className="font-bold">{option.label}</span>
              <span aria-hidden="true">]</span>
              {option.hint && (
                <span className="ml-1 text-[10px] tracking-widest opacity-60">
                  {option.hint}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {description && (
        <p id={descriptionId} className="text-xs text-ink/60 dark:text-bone/60">
          {description}
        </p>
      )}
    </div>
  );
};

export default BrutalSegmented;
