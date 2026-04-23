import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { PaginatedResult } from '@shared/types/api.js';
import type { SubscriptionEntry } from '@shared/types/subscription.js';
import type { Video } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../api/axios.js';
import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../components/feedback/EmptyState.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { VideoGrid } from '../components/video/VideoGrid.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import * as subscriptionService from '../services/subscription.service.js';
import { cn } from '../utils/classNames.js';
import { resolveAssetUrl } from '../utils/constants.js';
import { formatViews } from '../utils/formatViews.js';

const FEED_PAGE_SIZE = 24;

interface FetchError {
  message: string;
  requestId?: string;
}

const toFetchError = (err: ExtendedAxiosError, fallback: string): FetchError => ({
  message: err.response?.data?.message ?? err.message ?? fallback,
  ...(err.requestId ? { requestId: err.requestId } : {}),
});

interface ChannelChipProps {
  entry: SubscriptionEntry;
}

/**
 * Compact channel card used in the horizontal "channels you follow" strip.
 * Width is fixed so each card snaps cleanly when the parent scrolls.
 */
const ChannelChip = ({ entry }: ChannelChipProps) => {
  const reducedMotion = useReducedMotion();
  const { channel } = entry;
  const avatarSrc = resolveAssetUrl(channel.avatarUrl);
  const initial = (channel.displayName || channel.username).trim().charAt(0).toUpperCase() || '?';

  return (
    <Link
      to={`/c/${channel.username}`}
      aria-label={`Open ${channel.username}'s channel`}
      className={cn(
        'group flex w-44 shrink-0 flex-col items-center gap-2 border-2 border-ink bg-bone p-3 text-ink shadow-[var(--shadow-brutal-sm)] dark:bg-ink dark:text-bone',
        !reducedMotion &&
          'transition-transform duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
      )}
    >
      <div className="flex size-16 items-center justify-center overflow-hidden border-2 border-ink bg-bone dark:bg-ink">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-acid font-display text-2xl font-bold text-ink"
          >
            {initial}
          </span>
        )}
      </div>

      <span className="line-clamp-1 w-full text-center font-mono text-xs uppercase tracking-tight">
        // {channel.username}
      </span>

      <span className="font-mono text-[10px] uppercase tracking-widest tabular-nums opacity-60">
        {formatViews(channel.subscriberCount)} SUBS
      </span>
    </Link>
  );
};

export const SubscriptionsPage = () => {
  const [channels, setChannels] = useState<readonly SubscriptionEntry[] | null>(null);
  const [feed, setFeed] = useState<PaginatedResult<Video> | null>(null);

  const [channelsLoading, setChannelsLoading] = useState<boolean>(true);
  const [feedLoading, setFeedLoading] = useState<boolean>(true);

  const [channelsError, setChannelsError] = useState<FetchError | null>(null);
  const [feedError, setFeedError] = useState<FetchError | null>(null);

  const [feedPage, setFeedPage] = useState<number>(1);
  const [reloadToken, setReloadToken] = useState<number>(0);

  // Channels strip — only refetched on retry, since subscribing/unsubscribing
  // happens elsewhere (channel page) and would be reflected on next visit.
  useEffect(() => {
    let cancelled = false;
    setChannelsLoading(true);
    setChannelsError(null);

    subscriptionService
      .myChannels()
      .then((result) => {
        if (!cancelled) setChannels(result.items);
      })
      .catch((err: ExtendedAxiosError) => {
        if (!cancelled) {
          setChannelsError(toFetchError(err, 'Failed to load subscriptions'));
        }
      })
      .finally(() => {
        if (!cancelled) setChannelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    setFeedError(null);

    subscriptionService
      .subscriptionFeed({ page: feedPage, limit: FEED_PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setFeed(result);
      })
      .catch((err: ExtendedAxiosError) => {
        if (!cancelled) setFeedError(toFetchError(err, 'Failed to load feed'));
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feedPage, reloadToken]);

  const handlePageChange = useCallback((nextPage: number) => {
    setFeedPage(Math.max(1, nextPage));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRetry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const totalPages = feed?.totalPages ?? 1;
  const currentPage = feed?.page ?? feedPage;

  const pageIndicator = useMemo(() => {
    const pad = (value: number): string => value.toString().padStart(2, '0');
    return `PAGE ${pad(currentPage)} / ${pad(Math.max(totalPages, 1))}`;
  }, [currentPage, totalPages]);

  const showGlobalEmpty =
    !channelsLoading &&
    !feedLoading &&
    !channelsError &&
    !feedError &&
    (channels?.length ?? 0) === 0 &&
    (feed?.items.length ?? 0) === 0;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.4em] opacity-60">
          // FRAGMENT // PRIVATE BAND
        </p>
        <h1 className="font-display text-4xl font-bold uppercase leading-[0.9] tracking-tight md:text-5xl">
          // SUBSCRIPTIONS
        </h1>
        <p className="font-mono text-xs uppercase tracking-tight opacity-60">
          {'>>'} CURATED FREQUENCIES // ZERO ALGORITHM
        </p>
      </header>

      {showGlobalEmpty ? (
        <EmptyState
          title="// NO TRANSMISSIONS"
          description="follow a channel to start receiving signals"
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 border-2 border-ink bg-acid px-4 py-2 font-mono text-sm uppercase tracking-tight text-ink shadow-[var(--shadow-brutal)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              [ DISCOVER CHANNELS ]
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          <section aria-labelledby="channels-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2 dark:border-bone">
              <h2
                id="channels-heading"
                className="font-display text-xl uppercase tracking-tight md:text-2xl"
              >
                // CHANNELS YOU FOLLOW
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-widest opacity-60 tabular-nums">
                {channels ? `${channels.length} TOTAL` : '...'}
              </span>
            </div>

            {channelsError ? (
              <ErrorBlock
                message={channelsError.message}
                {...(channelsError.requestId ? { requestId: channelsError.requestId } : {})}
                onRetry={handleRetry}
              />
            ) : channelsLoading && !channels ? (
              <div className="flex justify-center py-10">
                <AsciiSpinner label="LOADING CHANNELS" />
              </div>
            ) : channels && channels.length > 0 ? (
              <div
                role="list"
                aria-label="Subscribed channels"
                className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
              >
                {channels.map((entry) => (
                  <div
                    key={entry.channel._id}
                    role="listitem"
                    className="snap-start"
                  >
                    <ChannelChip entry={entry} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="// NO CHANNELS"
                description="you're not following anyone yet"
              />
            )}
          </section>

          <section aria-labelledby="feed-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2 dark:border-bone">
              <h2
                id="feed-heading"
                className="font-display text-xl uppercase tracking-tight md:text-2xl"
              >
                // LATEST FROM YOUR CHANNELS
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-widest opacity-60 tabular-nums">
                {feed ? `${feed.total} SIGNALS` : '...'}
              </span>
            </div>

            {feedError && (
              <ErrorBlock
                message={feedError.message}
                {...(feedError.requestId ? { requestId: feedError.requestId } : {})}
                onRetry={handleRetry}
              />
            )}

            {feedLoading && !feed ? (
              <div className="flex justify-center py-20">
                <AsciiSpinner label="LOADING FEED" />
              </div>
            ) : feed && feed.items.length === 0 && !feedError ? (
              <EmptyState
                title="// NO TRANSMISSIONS"
                description="your channels haven't published anything new yet"
              />
            ) : feed ? (
              <div aria-busy={feedLoading || undefined}>
                <VideoGrid videos={feed.items} />
              </div>
            ) : null}

            {feed && feed.totalPages > 1 && (
              <nav
                aria-label="Feed pagination"
                className="mt-4 flex flex-wrap items-center justify-center gap-3 font-mono"
              >
                <BrutalButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || feedLoading}
                >
                  {'< PREV'}
                </BrutalButton>
                <span className="px-2 text-sm uppercase tracking-widest tabular-nums">
                  {pageIndicator}
                </span>
                <BrutalButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || feedLoading}
                >
                  {'NEXT >'}
                </BrutalButton>
              </nav>
            )}
          </section>
        </div>
      )}
    </section>
  );
};

export default SubscriptionsPage;
