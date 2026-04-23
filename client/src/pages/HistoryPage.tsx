import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { VideoAuthorRef, WatchHistoryEntry } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../api/axios.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../components/feedback/EmptyState.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import * as userService from '../services/user.service.js';
import { cn } from '../utils/classNames.js';
import { resolveAssetUrl } from '../utils/constants.js';
import { formatDuration } from '../utils/formatDuration.js';
import { formatRelativeDate } from '../utils/formatDate.js';
import { formatViews } from '../utils/formatViews.js';

const isAuthorRef = (value: unknown): value is VideoAuthorRef =>
  typeof value === 'object' && value !== null && 'username' in (value as object);

interface FetchError {
  message: string;
  requestId?: string;
}

const toFetchError = (err: ExtendedAxiosError, fallback: string): FetchError => ({
  message: err.response?.data?.message ?? err.message ?? fallback,
  ...(err.requestId ? { requestId: err.requestId } : {}),
});

interface HistoryRowProps {
  entry: WatchHistoryEntry;
}

/**
 * Vertical list row used by HistoryPage. Behaves as a single, full-width
 * "card" rather than a grid tile so the watch timestamp can sit prominently
 * to the right without competing for thumbnail real estate.
 */
const HistoryRow = ({ entry }: HistoryRowProps) => {
  const reducedMotion = useReducedMotion();
  const { video, viewedAt } = entry;
  const author = isAuthorRef(video.author) ? video.author : null;
  const thumbnailSrc = resolveAssetUrl(video.thumbnailPath);

  return (
    <article
      className={cn(
        'group flex flex-col gap-3 border-2 border-ink bg-bone p-3 text-ink shadow-[var(--shadow-brutal-sm)] sm:flex-row sm:items-stretch dark:bg-ink dark:text-bone',
        !reducedMotion &&
          'transition-transform duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
      )}
    >
      <Link
        to={`/v/${video.videoId}`}
        aria-label={`Watch ${video.title}`}
        className="relative block w-full shrink-0 overflow-hidden border-2 border-ink sm:w-56"
      >
        <div className="relative aspect-video w-full bg-ink/80">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-widest text-bone/60">
              // NO SIGNAL
            </div>
          )}
          <span className="absolute bottom-1.5 right-1.5 border-2 border-ink bg-bone px-1.5 py-0.5 font-mono text-[11px] tabular-nums tracking-tight text-ink shadow-[var(--shadow-brutal-sm)]">
            [ {formatDuration(video.duration)} ]
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5">
        <Link to={`/v/${video.videoId}`} className="block">
          <h3
            className={cn(
              'line-clamp-2 font-mono text-base font-semibold leading-tight tracking-tight',
              !reducedMotion && 'glitch'
            )}
          >
            {video.title}
          </h3>
        </Link>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] uppercase tracking-tight opacity-70">
          {author ? (
            <Link
              to={`/c/${author.username}`}
              className="hover:text-magenta hover:underline"
            >
              // {author.username}
            </Link>
          ) : (
            <span>// UNKNOWN</span>
          )}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatViews(video.views)} VIEWS
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeDate(video.createdAt)}</span>
        </p>

        {video.description && (
          <p className="line-clamp-2 max-w-2xl font-mono text-xs opacity-80">
            {video.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-start justify-between gap-2 border-l-0 border-t-2 border-ink pt-2 sm:items-end sm:border-l-2 sm:border-t-0 sm:pl-3 sm:pt-0">
        <span className="border-2 border-ink bg-acid px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink shadow-[var(--shadow-brutal-sm)]">
          // WATCHED
        </span>
        <time
          dateTime={viewedAt}
          className="font-mono text-[11px] uppercase tracking-tight tabular-nums opacity-80"
        >
          {formatRelativeDate(viewedAt)}
        </time>
      </div>
    </article>
  );
};

export const HistoryPage = () => {
  const [items, setItems] = useState<readonly WatchHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    userService
      .watchHistory()
      .then((payload) => {
        if (!cancelled) setItems(payload.items);
      })
      .catch((err: ExtendedAxiosError) => {
        if (!cancelled) setError(toFetchError(err, 'Failed to load watch history'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleRetry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const totalLabel = useMemo(() => {
    if (!items) return '...';
    return `${items.length.toString().padStart(2, '0')} ENTRIES`;
  }, [items]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.4em] opacity-60">
          // FRAGMENT // PERSONAL ARCHIVE
        </p>
        <h1 className="font-display text-4xl font-bold uppercase leading-[0.9] tracking-tight md:text-5xl">
          // WATCH HISTORY
        </h1>
        <p className="font-mono text-xs uppercase tracking-tight opacity-60">
          {'>>'} LAST 50 SIGNALS YOU TUNED INTO // {totalLabel}
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <ErrorBlock
            message={error.message}
            {...(error.requestId ? { requestId: error.requestId } : {})}
            onRetry={handleRetry}
          />
        </div>
      )}

      {loading && !items ? (
        <div className="flex justify-center py-20">
          <AsciiSpinner label="LOADING HISTORY" />
        </div>
      ) : items && items.length === 0 && !error ? (
        <EmptyState
          title="// VOID"
          description="no videos watched yet — go break the frame"
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 border-2 border-ink bg-acid px-4 py-2 font-mono text-sm uppercase tracking-tight text-ink shadow-[var(--shadow-brutal)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              [ BROWSE FEED ]
            </Link>
          }
        />
      ) : items ? (
        <div
          aria-busy={loading || undefined}
          className="flex flex-col gap-3"
        >
          {items.map((entry) => (
            <HistoryRow key={`${entry.video.videoId}-${entry.viewedAt}`} entry={entry} />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default HistoryPage;
