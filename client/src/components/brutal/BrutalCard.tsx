import type { HTMLAttributes, ReactNode } from 'react';

type Accent = 'acid' | 'magenta' | 'electric' | 'orange' | 'phosphor' | 'ink';

type BrutalCardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: Accent;
  hoverable?: boolean;
  children: ReactNode;
};

const ACCENT_BORDER: Record<Accent, string> = {
  acid: 'border-t-acid',
  magenta: 'border-t-magenta',
  electric: 'border-t-electric',
  orange: 'border-t-orange',
  phosphor: 'border-t-phosphor',
  ink: 'border-t-ink',
};

export const BrutalCard = ({
  accent,
  hoverable = false,
  children,
  className = '',
  ...rest
}: BrutalCardProps) => {
  const base =
    'relative border-2 border-ink bg-bone text-ink dark:bg-ink dark:text-bone shadow-(--shadow-brutal) p-(--pad,1rem)';
  const accentClass = accent ? `${ACCENT_BORDER[accent]} border-t-[6px]` : '';
  const hoverClass = hoverable
    ? 'transition-transform duration-100 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_var(--color-ink)] cursor-pointer'
    : '';

  return (
    <div className={`${base} ${accentClass} ${hoverClass} ${className}`} {...rest}>
      {children}
    </div>
  );
};

export default BrutalCard;
