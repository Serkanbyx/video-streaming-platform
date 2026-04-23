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
}

const isAuthorRef = (value: Video['author']): value is VideoAuthorRef =>
  typeof value === 'object' && value !== null;

export const VideoCard = ({
  video,
  density = 'comfortable',
  className = '',
}: VideoCardProps) => {
  const reducedMotion = useReducedMotion();

  const author = isAuthorRef(video.author) ? video.author : null;
  const channelHref = author ? `/c/${author.username}` : null;
  const thumbnailSrc = resolveAssetUrl(video.thumbnailPath);
  const isCompact = density === 'compact';

  return (
    <article
      className={cn(
        'group flex flex-col gap-2 border-2 border-ink bg-bone text-ink shadow-[var(--shadow-brutal-sm)] transition-transform duration-100 dark:bg-ink dark:text-bone',
        !reducedMotion &&
          'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
        className
      )}
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

          <span className="absolute bottom-2 right-2 border-2 border-ink bg-bone px-1.5 py-0.5 font-mono text-[11px] tabular-nums tracking-tight text-ink shadow-[var(--shadow-brutal-sm)]">
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
