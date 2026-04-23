import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { Video, VideoAuthorRef } from '@shared/types/video.js';

import { CommentList } from '../components/comment/CommentList.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { RecommendationsRail } from '../components/video/RecommendationsRail.js';
import { VideoMeta } from '../components/video/VideoMeta.js';
import { VideoPlayer } from '../components/video/VideoPlayer.js';
import * as videoService from '../services/video.service.js';
import type { ExtendedAxiosError } from '../api/axios.js';

import { NotFoundPage } from './NotFoundPage.js';

const isAuthorRef = (value: Video['author']): value is VideoAuthorRef =>
  typeof value === 'object' && value !== null;

export const VideoDetailPage = () => {
  const { videoId } = useParams<{ videoId: string }>();

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );
  const [reloadToken, setReloadToken] = useState<number>(0);
  const [liveViews, setLiveViews] = useState<number | null>(null);

  useEffect(() => {
    if (!videoId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLiveViews(null);

    videoService
      .getVideo(videoId)
      .then((data) => {
        if (!cancelled) setVideo(data);
      })
      .catch((err: ExtendedAxiosError) => {
        if (cancelled) return;
        setError({
          message:
            err.response?.data?.message ?? err.message ?? 'Failed to load video',
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

  // Reset top-of-page on navigation between videos so the player is always
  // immediately visible when the user clicks a recommendation.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [videoId]);

  if (!videoId) return <NotFoundPage />;

  if (loading) {
    return (
      <section className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-20">
        <AsciiSpinner label="LOADING SIGNAL" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-10">
        <ErrorBlock
          message={error.message}
          {...(error.requestId ? { requestId: error.requestId } : {})}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      </section>
    );
  }

  if (!video) return <NotFoundPage />;

  const author = isAuthorRef(video.author) ? video.author : null;
  const currentViews = liveViews ?? video.views;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <VideoPlayer
            videoId={video.videoId}
            hlsPath={video.hlsPath}
            onViewRecorded={(views) => setLiveViews(views)}
          />

          <VideoMeta video={video} views={currentViews} />

          <CommentList videoId={video.videoId} />
        </div>

        <div className="lg:col-span-4">
          <RecommendationsRail
            videoId={video.videoId}
            channelName={author?.username}
            channelId={author?._id}
          />
        </div>
      </div>
    </section>
  );
};

export default VideoDetailPage;
