import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'ink' | 'acid' | 'magenta' | 'electric' | 'orange' | 'phosphor';

type BrutalBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  bracketed?: boolean;
  children: ReactNode;
};

const TONE_CLASS: Record<Tone, string> = {
  ink: 'bg-ink text-bone',
  acid: 'bg-acid text-ink',
  magenta: 'bg-magenta text-bone',
  electric: 'bg-electric text-bone',
  orange: 'bg-orange text-ink',
  phosphor: 'bg-phosphor text-ink',
};

export const BrutalBadge = ({
  tone = 'ink',
  bracketed = true,
  children,
  className = '',
  ...rest
}: BrutalBadgeProps) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 border-2 border-ink uppercase text-xs font-mono tracking-tight tabular-nums ${TONE_CLASS[tone]} ${className}`}
      {...rest}
    >
      {bracketed && <span aria-hidden="true">[</span>}
      <span>{children}</span>
      {bracketed && <span aria-hidden="true">]</span>}
    </span>
  );
};

export default BrutalBadge;
