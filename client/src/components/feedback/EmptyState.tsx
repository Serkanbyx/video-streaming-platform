import type { ReactNode } from 'react';

import { BrutalCard } from '../brutal/BrutalCard.js';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) => (
  <BrutalCard
    accent="ink"
    className={`mx-auto flex w-full max-w-xl flex-col items-center gap-3 text-center ${className}`}
  >
    <span className="font-mono text-xs uppercase tracking-widest opacity-60">
      // EMPTY //
    </span>
    {icon && <div aria-hidden="true">{icon}</div>}
    <h2 className="font-display text-2xl uppercase tracking-tight md:text-3xl">
      {title}
    </h2>
    {description && (
      <p className="font-mono text-sm opacity-70">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </BrutalCard>
);

export default EmptyState;
