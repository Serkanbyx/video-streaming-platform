import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../components/brutal/BrutalDivider.js';
import { usePreferences } from '../context/PreferencesContext.js';

const FAKE_LOG_LINES = [
  '> ROUTE_TABLE :: scanning sectors 0x000-0xFFF',
  '> SIG_LOST   :: handshake timeout @ 1283 ms',
  '> FRAME_REF  :: integrity hash mismatch',
  '> CDN_EDGE   :: 04 nodes returned 404',
  '> RECOVERY   :: rerouting to nearest fragment',
  '> KERNEL     :: dump aborted (ENOENT)',
  '> DNS_RESOLV :: NXDOMAIN, retrying ...',
  '> CACHE_MISS :: payload not in storage',
  '> TLS_HSHK   :: 0x80004005 :: connection reset',
  '> WORKER     :: spawn failed -- ghost route',
] as const satisfies readonly string[];

const LOG_INTERVAL_MS = 1100;
const VISIBLE_LOG_COUNT = 5;

export const NotFoundPage = () => {
  const { preferences } = usePreferences();
  const motionOn = preferences.animations === 'full';

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setTick((value) => value + 1),
      LOG_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, []);

  const visibleLog = useMemo(() => {
    const start = tick % FAKE_LOG_LINES.length;
    return Array.from({ length: VISIBLE_LOG_COUNT }, (_, i) => {
      return FAKE_LOG_LINES[(start + i) % FAKE_LOG_LINES.length]!;
    });
  }, [tick]);

  return (
    <section className="relative isolate overflow-hidden">
      {motionOn && (
        <div
          aria-hidden="true"
          className="fragment-noise pointer-events-none absolute inset-0 -z-10 opacity-20 dark:opacity-30"
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-ink dark:bg-bone"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-12">
        <header className="flex items-baseline justify-between font-mono text-xs uppercase tracking-tight opacity-70">
          <span>// FRAGMENT-FAULT-LINE</span>
          <span aria-hidden="true">[ NODE-04 / SECTOR-04 ]</span>
        </header>

        <h1
          data-text="404"
          aria-label="404 Not Found"
          className={`select-none font-display font-black uppercase leading-[0.85] tracking-tight text-[clamp(7rem,24vw,22rem)] ${
            motionOn ? 'fragment-glitch-404' : ''
          }`}
        >
          404
        </h1>

        <BrutalDivider label="SIGNAL LOST" />

        <BrutalCard accent="magenta">
          <p className="font-display text-2xl uppercase tracking-tight md:text-3xl">
            // THE FRAME YOU SEEKING DOES NOT EXIST
          </p>
          <p className="mt-3 font-mono text-sm opacity-80">
            The route returned a clean miss. No payload, no fallback, no echo.
            Drop back to the index, recalibrate, and pick a different fragment.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 border-2 border-ink bg-acid px-4 py-2 font-mono uppercase tracking-tight text-ink shadow-(--shadow-brutal) hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              <span aria-hidden="true">[</span>
              <span>RETURN HOME</span>
              <span aria-hidden="true">]</span>
            </Link>

            <Link
              to="/me"
              className="inline-flex items-center gap-2 border-2 border-ink bg-transparent px-4 py-2 font-mono uppercase tracking-tight text-ink hover:bg-ink hover:text-bone dark:text-bone"
            >
              <span aria-hidden="true">[</span>
              <span>MY PROFILE</span>
              <span aria-hidden="true">]</span>
            </Link>
          </div>
        </BrutalCard>

        <aside
          aria-hidden="true"
          className="border-2 border-ink bg-ink p-3 font-mono text-[11px] uppercase leading-relaxed text-acid shadow-(--shadow-brutal) dark:bg-bone dark:text-ink"
        >
          {visibleLog.map((line, idx) => (
            <div
              key={`${tick}-${idx}`}
              className="truncate"
              style={{ opacity: 1 - idx * 0.15 }}
            >
              {line}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
};

export default NotFoundPage;
