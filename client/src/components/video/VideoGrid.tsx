import type { CSSProperties } from 'react';

import type { Video } from '@shared/types/video.js';

import { usePreferences } from '../../context/PreferencesContext.js';
import { cn } from '../../utils/classNames.js';
import { EmptyState } from '../feedback/EmptyState.js';
import { VideoCard } from './VideoCard.js';

interface VideoGridProps {
  videos: readonly Video[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  /**
   * When false the grid renders as a uniform 12-col flow without the
   * asymmetric span pattern. Useful for related-video rails.
   */
  asymmetric?: boolean;
  /**
   * Number of leading "hero" cards that auto-play their animated preview as
   * soon as the grid mounts. The remaining cards play their preview only on
   * hover/focus. Defaults to 0 (hover-only) so secondary surfaces such as
   * search results, channel pages and history stay calm.
   */
  autoPlayCount?: number;
}

/**
 * Returns the column span (out of 12) for a given index. The pattern creates
 * the brutalist "misaligned zine" feel called out in the design manifesto.
 * Order matters: the % 7 check wins over % 5 because 7 is rarer and produces
 * the dominant hero card.
 */
const spanForIndex = (index: number): number => {
  if (index % 7 === 0) return 6;
  if (index % 5 === 0) return 4;
  return 3;
};

export const VideoGrid = ({
  videos,
  emptyTitle = '// NO SIGNAL',
  emptyDescription = 'try a different query',
  className = '',
  asymmetric = true,
  autoPlayCount = 0,
}: VideoGridProps) => {
  const { preferences } = usePreferences();

  if (videos.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div
      role="list"
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12',
        className
      )}
    >
      {videos.map((video, index) => {
        const span = asymmetric ? spanForIndex(index) : 3;
        // Inline style avoids Tailwind JIT having to ship every col-span-N
        // class that the dynamic pattern can produce.
        const style: CSSProperties = {
          gridColumn: `span ${span} / span ${span}`,
        };
        return (
          <div key={video.videoId} role="listitem" style={style}>
            <VideoCard
              video={video}
              density={preferences.density}
              className="h-full"
              autoPlayPreview={index < autoPlayCount}
            />
          </div>
        );
      })}
    </div>
  );
};

export default VideoGrid;
