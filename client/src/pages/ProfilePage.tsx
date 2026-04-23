import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { ChannelProfile, Video, WatchHistoryEntry } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../api/axios.js';
import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { VideoCard } from '../components/video/VideoCard.js';
import { useAuth } from '../context/AuthContext.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import * as userService from '../services/user.service.js';
import * as videoService from '../services/video.service.js';
import { cn } from '../utils/classNames.js';
import { resolveAssetUrl } from '../utils/constants.js';
import { formatAbsoluteDate, formatRelativeDate } from '../utils/formatDate.js';
import { formatViews } from '../utils/formatViews.js';

const RECENT_UPLOADS_LIMIT = 6;
const RECENT_HISTORY_LIMIT = 4;

interface FetchError {
  message: string;
  requestId?: string;
}

const toFetchError = (err: ExtendedAxiosError, fallback: string): FetchError => ({
  message: err.response?.data?.message ?? err.message ?? fallback,
  ...(err.requestId ? { requestId: err.requestId } : {}),
});

interface QuickLinkProps {
  to: string;
  label: string;
  hint?: string;
  accent?: 'acid' | 'magenta' | 'electric' | 'orange' | 'phosphor';
}

const ACCENT_STYLES: Record<NonNullable<QuickLinkProps['accent']>, string> = {
  acid: 'border-t-acid',
  magenta: 'border-t-magenta',
  electric: 'border-t-electric',
  orange: 'border-t-orange',
  phosphor: 'border-t-phosphor',
};

const QuickLink = ({ to, label, hint, accent = 'acid' }: QuickLinkProps) => {
  const reducedMotion = useReducedMotion();

  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col gap-1 border-2 border-ink bg-bone p-3 text-ink shadow-(--shadow-brutal-sm) dark:bg-ink dark:text-bone',
        ACCENT_STYLES[accent],
        'border-t-[6px]',
        !reducedMotion &&
          'transition-transform duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
      )}
    >
      <span className="font-display text-sm font-bold uppercase tracking-tight md:text-base">
        [ {label} ]
      </span>
      {hint && (
        <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
          // {hint}
        </span>
      )}
    </Link>
  );
};

export const ProfilePage = () => {
  const { user, isCreator, becomeCreator } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ChannelProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<FetchError | null>(null);
  const [profileReloadToken, setProfileReloadToken] = useState<number>(0);

  const [recentUploads, setRecentUploads] = useState<readonly Video[] | null>(null);
  const [recentUploadsLoading, setRecentUploadsLoading] = useState<boolean>(false);

  const [recentHistory, setRecentHistory] = useState<readonly WatchHistoryEntry[] | null>(
    null
  );
  const [recentHistoryLoading, setRecentHistoryLoading] = useState<boolean>(true);

  const [becomePending, setBecomePending] = useState<boolean>(false);

  const username = user?.username;

  // Refetch the public profile so subscriber/video/view counts stay fresh
  // without having to wait for the next /me hydration.
  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    userService
      .getPublicProfile(username)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: ExtendedAxiosError) => {
        if (!cancelled) setProfileError(toFetchError(err, 'Failed to load profile'));
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, profileReloadToken]);

  // Recent uploads — only visible to creators, but harmless for viewers since
  // the API returns an empty page for them.
  useEffect(() => {
    if (!isCreator) {
      setRecentUploads([]);
      return undefined;
    }
    let cancelled = false;
    setRecentUploadsLoading(true);

    videoService
      .getMyVideos({ limit: RECENT_UPLOADS_LIMIT, sort: 'new' })
      .then((result) => {
        if (!cancelled) setRecentUploads(result.items);
      })
      .catch(() => {
        if (!cancelled) setRecentUploads([]);
      })
      .finally(() => {
        if (!cancelled) setRecentUploadsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isCreator]);

  useEffect(() => {
    let cancelled = false;
    setRecentHistoryLoading(true);

    userService
      .watchHistory()
      .then((payload) => {
        if (!cancelled) setRecentHistory(payload.items.slice(0, RECENT_HISTORY_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setRecentHistory([]);
      })
      .finally(() => {
        if (!cancelled) setRecentHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleBecomeCreator = useCallback(async () => {
    if (becomePending) return;
    setBecomePending(true);
    try {
      await becomeCreator();
      toast.success('// CREATOR ACCESS GRANTED');
      navigate('/upload');
    } catch (err) {
      const message =
        (err as ExtendedAxiosError).response?.data?.message ??
        'Could not upgrade your account';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setBecomePending(false);
    }
  }, [becomePending, becomeCreator, navigate]);

  const isViewer = Boolean(user && user.role === 'viewer');

  const quickLinks = useMemo<readonly QuickLinkProps[]>(() => {
    const links: QuickLinkProps[] = [];
    if (username) {
      links.push({
        to: `/c/${username}`,
        label: 'MY CHANNEL',
        hint: 'public view',
        accent: 'magenta',
      });
    }
    if (isCreator) {
      links.push({
        to: '/studio',
        label: 'STUDIO',
        hint: 'manage uploads',
        accent: 'acid',
      });
    }
    links.push({
      to: '/me/history',
      label: 'HISTORY',
      hint: 'recently watched',
      accent: 'electric',
    });
    links.push({
      to: '/me/subscriptions',
      label: 'SUBSCRIPTIONS',
      hint: 'channels you follow',
      accent: 'phosphor',
    });
    links.push({
      to: '/settings/profile',
      label: 'SETTINGS',
      hint: 'profile · privacy',
      accent: 'orange',
    });
    return links;
  }, [username, isCreator]);

  if (!user) return null;

  if (profileLoading && !profile) {
    return (
      <section className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-20">
        <AsciiSpinner label="LOADING PROFILE" />
      </section>
    );
  }

  if (profileError && !profile) {
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

  // Fall back to the in-memory user object if the channel fetch hasn't
  // resolved yet but we have hydration data — keeps the UI from flashing.
  const data: ChannelProfile = profile ?? {
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    subscriberCount: user.subscriberCount,
    videoCount: user.videoCount,
    totalViews: user.totalViews,
    createdAt: user.createdAt,
  };

  const bannerSrc = resolveAssetUrl(data.bannerUrl);
  const avatarSrc = resolveAssetUrl(data.avatarUrl);

  return (
    <section className="mx-auto w-full max-w-7xl pb-12">
      <div
        className="relative h-40 w-full overflow-hidden border-b-2 border-ink bg-ink md:h-60"
        aria-hidden={!data.bannerUrl}
      >
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,var(--color-ink)_0_12px,var(--color-magenta)_12px_24px)] opacity-90" />
        )}
        <span className="absolute bottom-2 left-4 border-2 border-ink bg-acid px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-ink shadow-(--shadow-brutal-sm)">
          // PROFILE // {data.username}
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-6">
        <header className="flex flex-col gap-4 border-2 border-ink bg-bone p-4 shadow-(--shadow-brutal) md:flex-row md:items-start md:gap-6 dark:bg-ink">
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
                // {data.displayName || data.username}
              </h1>
              <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs uppercase tracking-widest opacity-70">
                <span>@{data.username}</span>
                <span aria-hidden="true">//</span>
                <span className="border border-ink bg-bone px-1 py-0.5 text-[10px] tracking-tight text-ink dark:bg-ink dark:text-bone">
                  ROLE: {user.role}
                </span>
                {user.email && (
                  <>
                    <span aria-hidden="true">//</span>
                    <span className="lowercase tracking-tight">{user.email}</span>
                  </>
                )}
              </p>
            </div>

            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-tight tabular-nums">
              <span>{data.subscriberCount.toLocaleString()} SUBSCRIBERS</span>
              <span aria-hidden="true">//</span>
              <span>{data.videoCount.toLocaleString()} VIDEOS</span>
              <span aria-hidden="true">//</span>
              <span>{formatViews(data.totalViews)} VIEWS</span>
              <span aria-hidden="true">//</span>
              <span>JOINED {formatAbsoluteDate(data.createdAt)}</span>
            </p>

            {data.bio ? (
              <p className="line-clamp-3 max-w-2xl font-mono text-sm opacity-80">
                {data.bio}
              </p>
            ) : (
              <p className="font-mono text-xs uppercase tracking-tight opacity-50">
                // NO BIO TRANSMITTED // add one in settings
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <Link
              to="/settings/profile"
              className="inline-flex items-center justify-center gap-2 border-2 border-ink bg-acid px-3 py-1.5 font-mono text-xs uppercase tracking-tight text-ink shadow-(--shadow-brutal-sm) hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              [ EDIT PROFILE ]
            </Link>
            <Link
              to={`/c/${data.username}`}
              className="inline-flex items-center justify-center gap-2 border-2 border-ink bg-bone px-3 py-1.5 font-mono text-xs uppercase tracking-tight text-ink hover:bg-ink hover:text-bone dark:bg-ink dark:text-bone dark:hover:bg-bone dark:hover:text-ink"
            >
              [ VIEW CHANNEL ]
            </Link>
          </div>
        </header>

        <nav
          aria-label="Profile shortcuts"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {quickLinks.map((link) => (
            <QuickLink key={link.to} {...link} />
          ))}
        </nav>

        {isViewer && (
          <BrutalCard accent="magenta" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-xs uppercase tracking-widest opacity-60">
                // UPGRADE // GET UPLOAD ACCESS
              </p>
              <h2 className="font-display text-2xl uppercase tracking-tight md:text-3xl">
                BECOME A CREATOR
              </h2>
              <p className="font-mono text-sm opacity-80">
                Unlock uploads, the studio dashboard, and analytics for your channel.
              </p>
            </div>
            <BrutalButton onClick={handleBecomeCreator} disabled={becomePending}>
              {becomePending ? 'UPGRADING...' : 'BECOME CREATOR'}
            </BrutalButton>
          </BrutalCard>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {isCreator && (
            <section
              aria-labelledby="recent-uploads-heading"
              className="flex flex-col gap-3 lg:col-span-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2 dark:border-bone">
                <h2
                  id="recent-uploads-heading"
                  className="font-display text-xl uppercase tracking-tight md:text-2xl"
                >
                  // LATEST UPLOADS
                </h2>
                <Link
                  to="/studio"
                  className="font-mono text-[11px] uppercase tracking-widest hover:text-magenta hover:underline"
                >
                  [ OPEN STUDIO {'>'} ]
                </Link>
              </div>

              {recentUploadsLoading && !recentUploads ? (
                <div className="flex justify-center py-10">
                  <AsciiSpinner label="LOADING UPLOADS" />
                </div>
              ) : recentUploads && recentUploads.length === 0 ? (
                <div className="border-2 border-dashed border-ink/40 p-6 text-center font-mono text-xs uppercase tracking-widest opacity-60 dark:border-bone/40">
                  // NO UPLOADS YET // your studio is waiting
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {recentUploads?.map((video) => (
                    <VideoCard key={video.videoId} video={video} density="compact" />
                  ))}
                </div>
              )}
            </section>
          )}

          <section
            aria-labelledby="recent-history-heading"
            className={cn('flex flex-col gap-3', !isCreator && 'lg:col-span-3')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2 dark:border-bone">
              <h2
                id="recent-history-heading"
                className="font-display text-xl uppercase tracking-tight md:text-2xl"
              >
                // RECENTLY WATCHED
              </h2>
              <Link
                to="/me/history"
                className="font-mono text-[11px] uppercase tracking-widest hover:text-magenta hover:underline"
              >
                [ FULL HISTORY {'>'} ]
              </Link>
            </div>

            {recentHistoryLoading && !recentHistory ? (
              <div className="flex justify-center py-10">
                <AsciiSpinner label="LOADING HISTORY" />
              </div>
            ) : recentHistory && recentHistory.length === 0 ? (
              <div className="border-2 border-dashed border-ink/40 p-6 text-center font-mono text-xs uppercase tracking-widest opacity-60 dark:border-bone/40">
                // VOID // no videos watched yet
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentHistory?.map((entry) => (
                  <li
                    key={`${entry.video.videoId}-${entry.viewedAt}`}
                    className="flex items-stretch gap-2 border-2 border-ink bg-bone p-2 shadow-(--shadow-brutal-sm) dark:bg-ink"
                  >
                    <Link
                      to={`/v/${entry.video.videoId}`}
                      aria-label={`Watch ${entry.video.title}`}
                      className="block w-24 shrink-0 overflow-hidden border-2 border-ink bg-ink/80"
                    >
                      <div className="relative aspect-video w-full">
                        {resolveAssetUrl(entry.video.thumbnailPath) ? (
                          <img
                            src={resolveAssetUrl(entry.video.thumbnailPath)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-widest text-bone/60">
                            //
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-1 flex-col justify-between gap-1">
                      <Link
                        to={`/v/${entry.video.videoId}`}
                        className="line-clamp-2 font-mono text-xs font-semibold leading-snug tracking-tight hover:text-magenta"
                      >
                        {entry.video.title}
                      </Link>
                      <time
                        dateTime={entry.viewedAt}
                        className="font-mono text-[10px] uppercase tracking-widest opacity-60 tabular-nums"
                      >
                        {formatRelativeDate(entry.viewedAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};

export default ProfilePage;
