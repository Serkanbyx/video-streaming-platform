import { useId } from 'react';

type BrutalToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
};

export const BrutalToggle = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  name,
}: BrutalToggleProps) => {
  const autoId = useId();
  const inputId = id ?? `toggle-${autoId}`;
  const descriptionId = description ? `${inputId}-desc` : undefined;

  return (
    <label
      htmlFor={inputId}
      className={`flex items-start gap-3 font-mono select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input
        id={inputId}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={descriptionId}
        className="sr-only peer"
      />

      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1 border-2 border-ink bg-bone dark:bg-ink text-ink dark:text-bone text-sm font-bold tabular-nums peer-checked:bg-acid peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-electric peer-focus-visible:outline-offset-2"
      >
        {checked ? '[X]' : '[ ]'}
      </span>

      <span className="flex flex-col">
        <span className="text-sm uppercase tracking-tight">{label}</span>
        {description && (
          <span id={descriptionId} className="text-xs text-ink/60 dark:text-bone/60">
            {description}
          </span>
        )}
      </span>
    </label>
  );
};

export default BrutalToggle;
