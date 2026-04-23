interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
}

const TRACK_CELLS = 20;

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

/**
 * Brutalist horizontal progress bar. The track is a 2px-bordered rectangle
 * filled in 20 discrete cells (5% each), echoing the platform's blocky,
 * monospace aesthetic instead of a smooth gradient sweep.
 */
export const ProgressBar = ({
  value,
  label,
  className = '',
}: ProgressBarProps) => {
  const percent = clampPercent(value);
  const filledCells = Math.round((percent / 100) * TRACK_CELLS);

  return (
    <div className={`flex flex-col gap-2 font-mono ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs uppercase tracking-tight">
          <span className="opacity-70">// {label}</span>
          <span className="tabular-nums">{percent}% {'-->'}</span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ?? 'Upload progress'}
        className="flex h-6 items-stretch gap-[2px] border-2 border-ink bg-bone p-[2px] dark:bg-ink"
      >
        {Array.from({ length: TRACK_CELLS }).map((_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={
              index < filledCells
                ? 'flex-1 bg-acid'
                : 'flex-1 bg-transparent'
            }
          />
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
