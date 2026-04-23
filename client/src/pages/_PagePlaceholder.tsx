import type { ReactNode } from 'react';

import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../components/brutal/BrutalDivider.js';

interface PagePlaceholderProps {
  title: string;
  step: string;
  description?: string;
  children?: ReactNode;
}

/**
 * Temporary route surface for STEP 21. Each page in the routing table is
 * wired against this stub so the router resolves cleanly until the dedicated
 * implementation lands in its own step.
 */
export const PagePlaceholder = ({
  title,
  step,
  description,
  children,
}: PagePlaceholderProps) => (
  <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
    <BrutalCard accent="acid">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">// FRAGMENT</span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // {title}
        </h1>
      </header>

      <BrutalDivider label={step} />

      <p className="font-mono text-sm">
        {description ??
          'Route is wired. The full implementation will arrive in a later step.'}
      </p>

      {children && <div className="mt-4 font-mono text-sm">{children}</div>}
    </BrutalCard>
  </section>
);

export default PagePlaceholder;
