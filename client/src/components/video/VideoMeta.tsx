import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { Video, VideoAuthorRef } from '@shared/types/video.js';
import type { ReactionValue } from '@shared/constants/enums.js';

import { useAuth } from '../../context/AuthContext.js';
import * as likeService from '../../services/like.service.js';
import * as subscriptionService from '../../services/subscription.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';
import { cn } from '../../utils/classNames.js';
import { resolveAssetUrl } from '../../utils/constants.js';
import { formatViews } from '../../utils/formatViews.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

interface VideoMetaProps {
  video: Video;
  views: number;
}

const isAuthorRef = (value: Video['author']): value is VideoAuthorRef =>
  typeof value === 'object' && value !== null;

const absoluteDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const formatBrutalDate = (input: string): string =>
  absoluteDateFormatter.format(new Date(input)).toUpperCase();

const DESCRIPTION_PREVIEW_LINES = 4;

export const VideoMeta = ({ video, views }: VideoMetaProps) => {
  const { user, isAuthenticated } = useAuth();
  const reducedMotion = useReducedMotion();

  const author = isAuthorRef(video.author) ? video.author : null;
  const isOwner = Boolean(user && author && user._id === author._id);

  const [likeCount, setLikeCount] = useState<number>(video.likeCount);
  const [dislikeCount, setDislikeCount] = useState<number>(video.dislikeCount);
  const [reaction, setReaction] = useState<0 | 1 | -1>(0);
  const [reactionPending, setReactionPending] = useState<boolean>(false);

  const [subscriberCount, setSubscriberCount] = useState<number>(
    author?.subscriberCount ?? 0
  );
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [subscriptionPending, setSubscriptionPending] = useState<boolean>(false);

  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);

  // Sync the local counters whenever the parent fetches a fresh video doc
  // (e.g. after navigation) so we don't show stale optimistic values.
  useEffect(() => {
    setLikeCount(video.likeCount);
    setDislikeCount(video.dislikeCount);
  }, [video.likeCount, video.dislikeCount]);

  useEffect(() => {
    setSubscriberCount(author?.subscriberCount ?? 0);
  }, [author?.subscriberCount]);

  // Hydrate "my reaction" once we know who's logged in. Guests skip the
  // request entirely; the endpoint accepts anonymous calls but we'd just
  // get { value: 0 } back.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setReaction(0);
      return undefined;
    }
    likeService
      .getMyReaction(video.videoId)
      .then((result) => {
        if (!cancelled) setReaction(result.myReaction);
      })
      .catch(() => {
        /* keep reaction at 0 — non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, [video.videoId, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !author || isOwner) {
      setSubscribed(false);
      return undefined;
    }
    subscriptionService
      .isSubscribed(author._id)
      .then((status) => {
        if (cancelled) return;
        setSubscribed(status.isSubscribed);
        setSubscriberCount(status.subscriberCount);
      })
      .catch(() => {
        /* keep default — user can still click subscribe to retry */
      });
    return () => {
      cancelled = true;
    };
  }, [author, isAuthenticated, isOwner]);

  const handleReaction = async (next: ReactionValue): Promise<void> => {
    if (!isAuthenticated) {
      toast('// LOGIN TO REACT', { icon: '!' });
      return;
    }
    if (reactionPending) return;
    setReactionPending(true);

    const previous = { reaction, likeCount, dislikeCount };
    const isClearing = reaction === next;

    if (isClearing) {
      setReaction(0);
      if (next === 1) setLikeCount((value) => Math.max(0, value - 1));
      else setDislikeCount((value) => Math.max(0, value - 1));
    } else {
      setReaction(next);
      if (next === 1) {
        setLikeCount((value) => value + 1);
        if (reaction === -1) setDislikeCount((value) => Math.max(0, value - 1));
      } else {
        setDislikeCount((value) => value + 1);
        if (reaction === 1) setLikeCount((value) => Math.max(0, value - 1));
      }
    }

    try {
      const result = isClearing
        ? await likeService.removeReaction(video.videoId)
        : await likeService.setReaction(video.videoId, next);
      setLikeCount(result.likeCount);
      setDislikeCount(result.dislikeCount);
      setReaction(result.myReaction);
    } catch (error) {
      setReaction(previous.reaction);
      setLikeCount(previous.likeCount);
      setDislikeCount(previous.dislikeCount);
      const message =
        (error as ExtendedAxiosError).response?.data?.message ??
        'Could not update reaction';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setReactionPending(false);
    }
  };

  const handleSubscribeToggle = async (): Promise<void> => {
    if (!isAuthenticated || !author) {
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
        ? await subscriptionService.unsubscribe(author._id)
        : await subscriptionService.subscribe(author._id);
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
  };

  const descriptionLines = useMemo(
    () => video.description.split('\n').filter((line) => line.length > 0),
    [video.description]
  );
  const hasMoreDescription = descriptionLines.length > DESCRIPTION_PREVIEW_LINES;
  const visibleDescription =
    descriptionExpanded || !hasMoreDescription
      ? video.description
      : descriptionLines.slice(0, DESCRIPTION_PREVIEW_LINES).join('\n');

  const channelHref = author ? `/c/${author.username}` : '#';
  const avatarSrc = resolveAssetUrl(author?.avatarUrl ?? null);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1
          className={cn(
            'font-display text-3xl font-bold uppercase leading-[0.95] tracking-tight md:text-4xl lg:text-5xl',
            !reducedMotion && 'glitch'
          )}
        >
          {video.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-tight opacity-80">
          {isOwner && (
            <span className="border-2 border-ink bg-acid px-2 py-0.5 text-ink">
              [ READY ]
            </span>
          )}
          <span className="tabular-nums">{formatViews(views)} VIEWS {'-->'}</span>
          <span aria-hidden="true">·</span>
          <span>// {formatBrutalDate(video.createdAt)}</span>
          {video.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="opacity-70">#{video.tags.join(' #')}</span>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 border-2 border-ink bg-bone p-3 shadow-[var(--shadow-brutal-sm)] md:flex-row md:items-center md:justify-between dark:bg-ink">
        <div className="flex items-center gap-3">
          <Link
            to={channelHref}
            aria-label={author ? `Visit ${author.username}` : 'Unknown channel'}
            className="block size-12 shrink-0 overflow-hidden border-2 border-ink bg-bone dark:bg-ink"
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-widest opacity-60">
                ::
              </span>
            )}
          </Link>

          <div className="flex flex-col font-mono text-xs uppercase">
            <Link
              to={channelHref}
              className="text-sm font-semibold tracking-tight hover:text-magenta hover:underline"
            >
              // {author?.username ?? 'unknown'}
            </Link>
            <span className="tabular-nums opacity-70">
              {subscriberCount.toLocaleString()} SUBSCRIBERS
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isOwner && (
            <button
              type="button"
              onClick={handleSubscribeToggle}
              disabled={subscriptionPending}
              aria-pressed={subscribed}
              className={cn(
                'inline-flex items-center gap-1 border-2 border-ink px-3 py-1.5 font-mono text-xs uppercase tracking-tight transition-none disabled:opacity-50',
                subscribed
                  ? 'bg-ink text-acid'
                  : 'bg-magenta text-ink shadow-[var(--shadow-brutal-sm)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
              )}
            >
              [ {subscribed ? 'SUBSCRIBED' : 'SUBSCRIBE'} ]
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleReaction(1)}
              disabled={reactionPending}
              aria-pressed={reaction === 1}
              aria-label={`Like — ${likeCount}`}
              className={cn(
                'inline-flex items-center gap-1 border-2 border-ink px-3 py-1.5 font-mono text-xs uppercase tracking-tight tabular-nums transition-none disabled:opacity-50',
                reaction === 1
                  ? 'bg-acid text-ink shadow-[var(--shadow-brutal-sm)]'
                  : 'bg-transparent text-ink dark:text-bone hover:bg-ink hover:text-bone'
              )}
            >
              [ + {likeCount.toLocaleString()} ]
            </button>
            <button
              type="button"
              onClick={() => handleReaction(-1)}
              disabled={reactionPending}
              aria-pressed={reaction === -1}
              aria-label={`Dislike — ${dislikeCount}`}
              className={cn(
                'inline-flex items-center gap-1 border-2 border-ink px-3 py-1.5 font-mono text-xs uppercase tracking-tight tabular-nums transition-none disabled:opacity-50',
                reaction === -1
                  ? 'bg-orange text-ink shadow-[var(--shadow-brutal-sm)]'
                  : 'bg-transparent text-ink dark:text-bone hover:bg-ink hover:text-bone'
              )}
            >
              [ - {dislikeCount.toLocaleString()} ]
            </button>
          </div>
        </div>
      </div>

      {video.description && (
        <div className="border-2 border-ink bg-bone p-3 font-mono text-sm shadow-[var(--shadow-brutal-sm)] dark:bg-ink">
          <p className="whitespace-pre-wrap break-words">
            {visibleDescription || '// NO TRANSMISSION LOG'}
          </p>

          {hasMoreDescription && (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((value) => !value)}
              className="mt-2 inline-flex items-center gap-1 border-2 border-ink bg-transparent px-2 py-0.5 text-xs uppercase tracking-tight text-ink hover:bg-ink hover:text-bone dark:text-bone"
            >
              [ {descriptionExpanded ? 'COLLAPSE' : 'EXPAND'} ]
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default VideoMeta;
