import type { HTMLAttributes } from 'react';

type BrutalDividerProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

export const BrutalDivider = ({
  label,
  className = '',
  ...rest
}: BrutalDividerProps) => {
  if (!label) {
    return (
      <hr
        className={`border-0 border-t-2 border-ink my-4 ${className}`}
        {...(rest as HTMLAttributes<HTMLHRElement>)}
      />
    );
  }

  return (
    <div
      role="separator"
      aria-label={label}
      className={`flex items-center gap-3 my-4 font-mono uppercase text-xs tracking-tight text-ink dark:text-bone ${className}`}
      {...rest}
    >
      <span className="flex-1 border-t-2 border-ink" aria-hidden="true" />
      <span className="px-2 whitespace-nowrap">// {label} //</span>
      <span className="flex-1 border-t-2 border-ink" aria-hidden="true" />
    </div>
  );
};

export default BrutalDivider;
