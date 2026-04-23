import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { PaginatedResult } from '@shared/types/api.js';
import type { ChannelProfile, Video } from '@shared/types/video.js';

import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../components/feedback/EmptyState.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { VideoGrid } from '../components/video/VideoGrid.js';
import { useAuth } from '../context/AuthContext.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as userService from '../services/user.service.js';
import * as videoService from '../services/video.service.js';
import { cn } from '../utils/classNames.js';
import { resolveAssetUrl } from '../utils/constants.js';
import { formatAbsoluteDate } from '../utils/formatDate.js';
import { formatViews } from '../utils/formatViews.js';
import type { ExtendedAxiosError } from '../api/axios.js';

import { NotFoundPage } from './NotFoundPage.js';

const VIDEOS_PAGE_SIZE = 12;
const TAB_KEYS = ['videos', 'about'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const isTabKey = (value: string | null): value is TabKey =>
  value !== null && (TAB_KEYS as readonly string[]).includes(value);

const TAB_LABELS: Record<TabKey, string> = {
  videos: 'VIDEOS',
  about: 'ABOUT',
};

interface FetchError {
  message: string;
  requestId?: string;
  status?: number;
}

const toFetchError = (err: ExtendedAxiosError, fallback: string): FetchError => ({
  message: err.response?.data?.message ?? err.message ?? fallback,
  ...(err.requestId ? { requestId: err.requestId } : {}),
  ...(err.response?.status ? { status: err.response.status } : {}),
});

export const ChannelPage = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const activeTab: TabKey = isTabKey(searchParams.get('tab'))
    ? (searchParams.get('tab') as TabKey)
    : 'videos';

  const [profile, setProfile] = useState<ChannelProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<FetchError | null>(null);
  const [profileReloadToken, setProfileReloadToken] = useState<number>(0);

  const [videos, setVideos] = useState<PaginatedResult<Video> | null>(null);
  const [videosLoading, setVideosLoading] = useState<boolean>(false);
  const [videosError, setVideosError] = useState<FetchError | null>(null);
  const [videosReloadToken, setVideosReloadToken] = useState<number>(0);
  const [videosPage, setVideosPage] = useState<number>(1);

  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const [subscriptionPending, setSubscriptionPending] = useState<boolean>(false);

  // Profile fetch
  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    userService
      .getPublicProfile(username)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setSubscriberCount(data.subscriberCount);
      })
      .catch((err: ExtendedAxiosError) => {
        if (!cancelled) setProfileError(toFetchError(err, 'Failed to load channel'));
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, profileReloadToken]);

  // Videos fetch (only when channel resolved)
  useEffect(() => {
    if (!profile?._id) return undefined;
    let cancelled = false;
    setVideosLoading(true);
    setVideosError(null);

    videoService
      .getByChannel(profile._id, { page: videosPage, limit: VIDEOS_PAGE_SIZE, sort: 'new' })
      .then((result) => {
        if (!cancelled) setVideos(result);
      })
      .catch((err: ExtendedAxiosError) => {
        if (!cancelled) setVideosError(toFetchError(err, 'Failed to load videos'));
      })
      .finally(() => {
        if (!cancelled) setVideosLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?._id, videosPage, videosReloadToken]);

  // Hydrate subscription status. Skip when guest or viewing own channel — the
  // backend would return false either way and we hide the subscribe button.
  const isOwner = Boolean(user && profile && user._id === profile._id);

  useEffect(() => {
    if (!profile?._id || !isAuthenticated || isOwner) {
      setSubscribed(false);
      return undefined;
    }
    let cancelled = false;
    subscriptionService
      .isSubscribed(profile._id)
      .then((status) => {
        if (cancelled) return;
        setSubscribed(status.isSubscribed);
        setSubscriberCount(status.subscriberCount);
      })
      .catch(() => {
        /* keep defaults — non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, [profile?._id, isAuthenticated, isOwner]);

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      const next = new URLSearchParams(searchParams);
      if (tab === 'videos') next.delete('tab');
      else next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handlePageChange = useCallback((page: number) => {
    setVideosPage(Math.max(1, page));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSubscribeToggle = useCallback(async () => {
    if (!profile) return;
    if (!isAuthenticated) {
      toast('// LOGIN TO SUBSCRIBE', { icon: '!' });
      return;
    }
    if (isOwner || subscriptionPending) return;
    setSubscriptionPending(true);

    const previousSubscribed = subscribed;
    const previousCount = subscriberCount;

    setSubscribed(!subscribed);
    setSubscriberCount((value) => Math.max(0, value + (subscribed ? -1 : 1)));

    try {
      const status = subscribed
        ? await subscriptionService.unsubscribe(profile._id)
        : await subscriptionService.subscribe(profile._id);
      setSubscribed(status.isSubscribed);
      setSubscriberCount(status.subscriberCount);
    } catch (error) {
      setSubscribed(previousSubscribed);
      setSubscriberCount(previousCount);
      const message =
        (error as ExtendedAxiosError).response?.data?.message ??
        'Could not update subscription';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setSubscriptionPending(false);
    }
  }, [profile, isAuthenticated, isOwner, subscriptionPending, subscribed, subscriberCount]);

  const totalPages = videos?.totalPages ?? 1;
  const currentPage = videos?.page ?? videosPage;

  const pageIndicator = useMemo(() => {
    const pad = (value: number): string => value.toString().padStart(2, '0');
    return `PAGE ${pad(currentPage)} / ${pad(Math.max(totalPages, 1))}`;
  }, [currentPage, totalPages]);

  if (!username) return <NotFoundPage />;

  if (profileLoading && !profile) {
    return (
      <section className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-20">
        <AsciiSpinner label="LOADING CHANNEL" />
      </section>
    );
  }

  if (profileError) {
    if (profileError.status === 404) return <NotFoundPage />;
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-10">
        <ErrorBlock
          message={profileError.message}
          {...(profileError.requestId ? { requestId: profileError.requestId } : {})}
          onRetry={() => setProfileReloadToken((value) => value + 1)}
        />
      </section>
    );
  }

  if (!profile) return <NotFoundPage />;

  const bannerSrc = resolveAssetUrl(profile.bannerUrl);
  const avatarSrc = resolveAssetUrl(profile.avatarUrl);

  return (
    <section className="mx-auto w-full max-w-7xl pb-10">
      <div
        className="relative h-[160px] w-full overflow-hidden border-b-2 border-ink bg-ink md:h-[240px]"
        aria-hidden={!profile.bannerUrl}
      >
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div
            className="h-full w-full bg-[repeating-linear-gradient(45deg,var(--color-ink)_0_12px,var(--color-magenta)_12px_24px)] opacity-90"
          />
        )}
        <span className="absolute bottom-2 left-4 border-2 border-ink bg-bone px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-ink shadow-[var(--shadow-brutal-sm)]">
          // CHANNEL // {profile.username}
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6">
        <header className="flex flex-col gap-4 border-2 border-ink bg-bone p-4 shadow-[var(--shadow-brutal)] md:flex-row md:items-start md:gap-6 dark:bg-ink">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-bone dark:bg-ink">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="font-mono text-xs uppercase tracking-widest opacity-60">
                ::
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-tight md:text-5xl">
                // {profile.displayName || profile.username}
              </h1>
              <p className="font-mono text-xs uppercase tracking-widest opacity-70">
                @{profile.username}
              </p>
            </div>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-tight tabular-nums">
              <span>{subscriberCount.toLocaleString()} SUBSCRIBERS</span>
              <span aria-hidden="true">//</span>
              <span>{profile.videoCount.toLocaleString()} VIDEOS</span>
              <span aria-hidden="true">//</span>
              <span>{formatViews(profile.totalViews)} VIEWS</span>
            </p>

            {profile.bio && (
              <p className="line-clamp-3 max-w-2xl font-mono text-sm opacity-80">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-start">
            {!isOwner && (
              <BrutalButton
                variant={subscribed ? 'outline' : 'solid'}
                onClick={handleSubscribeToggle}
                disabled={subscriptionPending}
                aria-pressed={subscribed}
              >
                {subscribed ? 'SUBSCRIBED' : 'SUBSCRIBE'}
              </BrutalButton>
            )}
            {isOwner && (
              <span className="border-2 border-ink bg-acid px-2 py-1 font-mono text-xs uppercase tracking-widest text-ink shadow-[var(--shadow-brutal-sm)]">
                // YOUR CHANNEL
              </span>
            )}
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Channel sections"
          className="flex flex-wrap items-center gap-2 border-b-2 border-ink pb-3 dark:border-bone"
        >
          {TAB_KEYS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  'border-2 border-ink px-3 py-1 font-mono text-xs uppercase tracking-tight transition-none',
                  active
                    ? 'bg-ink text-acid'
                    : 'bg-transparent text-ink hover:bg-ink hover:text-bone dark:text-bone'
                )}
              >
                [ {TAB_LABELS[tab]} ]
              </button>
            );
          })}
        </div>

        {activeTab === 'videos' && (
          <div className="flex flex-col gap-6">
            {videosError && (
              <ErrorBlock
                message={videosError.message}
                {...(videosError.requestId ? { requestId: videosError.requestId } : {})}
                onRetry={() => setVideosReloadToken((value) => value + 1)}
              />
            )}

            {videosLoading && !videos ? (
              <div className="flex justify-center py-20">
                <AsciiSpinner label="LOADING VIDEOS" />
              </div>
            ) : videos && videos.items.length === 0 && !videosError ? (
              <EmptyState
                title="// NO TRANSMISSIONS"
                description={`@${profile.username} has not published any videos yet.`}
              />
            ) : videos ? (
              <div aria-busy={videosLoading || undefined}>
                <VideoGrid videos={videos.items} />
              </div>
            ) : null}

            {videos && videos.totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-2 flex flex-wrap items-center justify-center gap-3 font-mono"
              >
                <BrutalButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || videosLoading}
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
                  disabled={currentPage >= totalPages || videosLoading}
                >
                  {'NEXT >'}
                </BrutalButton>
              </nav>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="lg:col-span-2 border-2 border-ink bg-bone p-4 font-mono text-sm shadow-[var(--shadow-brutal-sm)] dark:bg-ink">
              <h2 className="mb-3 font-display text-xl uppercase tracking-tight">
                // BIO //
              </h2>
              {profile.bio ? (
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                  {profile.bio}
                </p>
              ) : (
                <p className="opacity-60">// NO BIO TRANSMITTED</p>
              )}
            </article>

            <aside className="border-2 border-ink bg-bone p-4 font-mono text-sm shadow-[var(--shadow-brutal-sm)] dark:bg-ink">
              <h2 className="mb-3 font-display text-xl uppercase tracking-tight">
                // META //
              </h2>
              <dl className="flex flex-col gap-2 text-xs uppercase tracking-tight">
                <div className="flex items-center justify-between gap-2">
                  <dt className="opacity-60">JOINED</dt>
                  <dd className="tabular-nums">{formatAbsoluteDate(profile.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="opacity-60">VIDEOS</dt>
                  <dd className="tabular-nums">{profile.videoCount.toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="opacity-60">SUBSCRIBERS</dt>
                  <dd className="tabular-nums">{subscriberCount.toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="opacity-60">TOTAL VIEWS</dt>
                  <dd className="tabular-nums">{formatViews(profile.totalViews)}</dd>
                </div>
              </dl>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
};

export default ChannelPage;
