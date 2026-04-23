import { useEffect, useMemo, useState } from 'react';

import type { Video, VideoAuthorRef } from '@shared/types/video.js';

import * as videoService from '../../services/video.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';
import { ErrorBlock } from '../feedback/ErrorBlock.js';
import { VideoCard } from './VideoCard.js';

interface RecommendationsRailProps {
  videoId: string;
  channelName?: string;
  channelId?: string;
}

const isAuthorRef = (value: Video['author']): value is VideoAuthorRef =>
  typeof value === 'object' && value !== null;

const matchesAuthor = (video: Video, channelId?: string): boolean => {
  if (!channelId) return false;
  if (typeof video.author === 'string') return video.author === channelId;
  if (isAuthorRef(video.author)) return video.author._id === channelId;
  return false;
};

export const RecommendationsRail = ({
  videoId,
  channelName,
  channelId,
}: RecommendationsRailProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    videoService
      .getRecommendations(videoId)
      .then((result) => {
        if (cancelled) return;
        setVideos(result.items);
      })
      .catch((err: ExtendedAxiosError) => {
        if (cancelled) return;
        setError({
          message:
            err.response?.data?.message ??
            err.message ??
            'Failed to load recommendations',
          ...(err.requestId ? { requestId: err.requestId } : {}),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, reloadToken]);

  const { sameChannel, others } = useMemo(() => {
    const sameChannel: Video[] = [];
    const others: Video[] = [];
    for (const video of videos) {
      if (matchesAuthor(video, channelId)) sameChannel.push(video);
      else others.push(video);
    }
    return { sameChannel, others };
  }, [videos, channelId]);

  return (
    <aside aria-label="Related videos" className="flex flex-col gap-3">
      <header className="flex items-center justify-between border-b-2 border-ink pb-2 dark:border-bone">
        <h2 className="font-mono text-sm uppercase tracking-tight">
          // RELATED SIGNALS
        </h2>
        <span className="font-mono text-xs uppercase opacity-60">{'-->'}</span>
      </header>

      {loading && (
        <div className="flex justify-center py-8">
          <AsciiSpinner label="LOADING SIGNAL" />
        </div>
      )}

      {error && (
        <ErrorBlock
          message={error.message}
          {...(error.requestId ? { requestId: error.requestId } : {})}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      )}

      {!loading && !error && videos.length === 0 && (
        <p className="border-2 border-dashed border-ink bg-bone p-3 text-center font-mono text-xs uppercase tracking-widest opacity-60 dark:bg-ink">
          // NOTHING TO RELAY
        </p>
      )}

      {sameChannel.length > 0 && (
        <>
          {channelName && (
            <p className="font-mono text-[11px] uppercase tracking-tight opacity-70">
              // MORE FROM // {channelName}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {sameChannel.map((video) => (
              <li key={video.videoId}>
                <VideoCard video={video} density="compact" />
              </li>
            ))}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <>
          {sameChannel.length > 0 && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-tight opacity-70">
              // GLOBAL FEED
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {others.map((video) => (
              <li key={video.videoId}>
                <VideoCard video={video} density="compact" />
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
};

export default RecommendationsRail;
