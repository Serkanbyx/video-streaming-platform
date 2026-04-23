import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Video, VideoAuthorRef } from '@shared/types/video.js';

import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { cn } from '../../utils/classNames.js';
import { resolveAssetUrl } from '../../utils/constants.js';
import { formatRelativeDate } from '../../utils/formatDate.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { formatViews } from '../../utils/formatViews.js';

interface VideoCardProps {
  video: Video;
  density?: 'compact' | 'comfortable';
  className?: string;
  /**
   * When true, the animated MP4 preview starts playing as soon as the card is
   * visible (used for "hero" cards in the top row). When false (default), the
   * preview only plays on hover or focus, matching the YouTube/Vimeo pattern.
   * Either mode is fully suppressed if the user has `prefers-reduced-motion`.
   */
  autoPlayPreview?: boolean;
}

const isAuthorRef = (value: Video['author']): value is VideoAuthorRef =>
  typeof value === 'object' && value !== null;

export const VideoCard = ({
  video,
  density = 'comfortable',
  className = '',
  autoPlayPreview = false,
}: VideoCardProps) => {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewActive, setPreviewActive] = useState(false);

  const author = isAuthorRef(video.author) ? video.author : null;
  const channelHref = author ? `/c/${author.username}` : null;
  const thumbnailSrc = resolveAssetUrl(video.thumbnailPath);
  const previewSrc = resolveAssetUrl(video.previewPath);
  const isCompact = density === 'compact';
  const wantsPreview = Boolean(previewSrc) && !reducedMotion;
  const shouldShowPreview = wantsPreview && (autoPlayPreview || previewActive);

  // Defer attaching the <video> element until needed to keep initial paint
  // cheap and avoid prefetching every preview file in long grids. For hover
  // cards the element mounts on first interaction; for hero cards it mounts
  // immediately and starts auto-playing.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (shouldShowPreview) {
      node.currentTime = 0;
      void node.play().catch(() => {
        // Autoplay can be blocked on first navigation in some browsers; the
        // static thumbnail underneath remains a perfectly valid fallback.
      });
    } else {
      node.pause();
    }
  }, [shouldShowPreview]);

  const handleHoverStart = () => {
    if (!wantsPreview || autoPlayPreview) return;
    setPreviewActive(true);
  };
  const handleHoverEnd = () => {
    if (autoPlayPreview) return;
    setPreviewActive(false);
  };

  return (
    <article
      className={cn(
        'group flex flex-col gap-2 border-2 border-ink bg-bone text-ink shadow-(--shadow-brutal-sm) transition-transform duration-100 dark:bg-ink dark:text-bone',
        !reducedMotion &&
          'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
        className
      )}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onFocus={handleHoverStart}
      onBlur={handleHoverEnd}
    >
      <Link
        to={`/v/${video.videoId}`}
        aria-label={`Watch ${video.title}`}
        className="relative block overflow-hidden border-b-2 border-ink"
      >
        <div className="relative aspect-video w-full bg-ink/80">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                'h-full w-full object-cover',
                !reducedMotion &&
                  'transition-[mix-blend-mode] duration-100 group-hover:mix-blend-difference'
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-widest text-bone/60">
              // NO SIGNAL
            </div>
          )}

          {shouldShowPreview && (
            <video
              ref={videoRef}
              src={previewSrc}
              muted
              loop
              playsInline
              autoPlay
              preload={autoPlayPreview ? 'auto' : 'metadata'}
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          <span className="absolute bottom-2 right-2 z-10 border-2 border-ink bg-bone px-1.5 py-0.5 font-mono text-[11px] tabular-nums tracking-tight text-ink shadow-(--shadow-brutal-sm)">
            [ {formatDuration(video.duration)} ]
          </span>
        </div>
      </Link>

      <div
        className={cn(
          'flex flex-col gap-1 px-3',
          isCompact ? 'pb-2' : 'pb-3'
        )}
      >
        <Link to={`/v/${video.videoId}`} className="block">
          <h3
            className={cn(
              'line-clamp-2 font-mono font-semibold leading-tight tracking-tight',
              isCompact ? 'text-sm uppercase' : 'text-base',
              !reducedMotion && 'glitch'
            )}
          >
            {video.title}
          </h3>
        </Link>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] uppercase tracking-tight opacity-70">
          {channelHref ? (
            <Link
              to={channelHref}
              className="hover:text-magenta hover:underline"
            >
              // {author?.username}
            </Link>
          ) : (
            <span>// UNKNOWN</span>
          )}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatViews(video.views)} VIEWS {'-->'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeDate(video.createdAt)}</span>
        </p>
      </div>
    </article>
  );
};

export default VideoCard;
