import { Link } from 'react-router-dom';

import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../components/brutal/BrutalDivider.js';

export const NotFoundPage = () => (
  <section className="mx-auto w-full max-w-2xl p-6 md:p-10">
    <BrutalCard accent="magenta">
      <header>
        <h1 className="font-display text-5xl uppercase tracking-tight md:text-6xl">
          404
        </h1>
        <p className="mt-2 font-mono text-xs uppercase opacity-70">// SIGNAL LOST</p>
      </header>

      <BrutalDivider label="ROUTE NOT FOUND" />

      <p className="font-mono text-sm">
        The frame you are seeking does not exist. STEP 34 turns this into the
        full glitch experience.
      </p>

      <div className="mt-6 flex justify-end">
        <Link
          to="/"
          className="inline-flex items-center gap-2 border-2 border-ink bg-acid px-4 py-2 font-mono uppercase tracking-tight text-ink shadow-[var(--shadow-brutal)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          <span aria-hidden="true">[</span>
          <span>RETURN HOME</span>
          <span aria-hidden="true">]</span>
        </Link>
      </div>
    </BrutalCard>
  </section>
);

export default NotFoundPage;
