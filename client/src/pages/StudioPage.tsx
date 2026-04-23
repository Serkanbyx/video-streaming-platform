import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  VIDEO_STATUSES,
  type VideoStatus,
} from '@shared/constants/enums.js';
import type { Video } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../api/axios.js';
import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../components/feedback/EmptyState.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { DeleteVideoModal } from '../components/studio/DeleteVideoModal.js';
import { EditVideoModal } from '../components/studio/EditVideoModal.js';
import { StatusBadge } from '../components/studio/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { getMyVideos } from '../services/video.service.js';
import { cn } from '../utils/classNames.js';
import { resolveAssetUrl } from '../utils/constants.js';
import { formatRelativeDate } from '../utils/formatDate.js';
import { formatViews } from '../utils/formatViews.js';

const PAGE_SIZE = 48;
const MAX_FETCH_PAGES = 50;

type StatusFilter = VideoStatus | 'all';
const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...VIDEO_STATUSES];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'ALL',
  pending: 'PENDING',
  processing: 'PROCESSING',
  ready: 'READY',
  failed: 'FAILED',
};

interface KpiValues {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  subscribers: number;
}

const formatNumber = (value: number): string => formatViews(value);

const computeStatusCounts = (
  videos: readonly Video[]
): Record<StatusFilter, number> => {
  const counts: Record<StatusFilter, number> = {
    all: videos.length,
    pending: 0,
    processing: 0,
    ready: 0,
    failed: 0,
  };
  for (const video of videos) counts[video.status] += 1;
  return counts;
};

interface KpiCardProps {
  label: string;
  value: string;
  accent: 'acid' | 'magenta' | 'electric' | 'orange';
}

const KpiCard = ({ label, value, accent }: KpiCardProps) => (
  <BrutalCard accent={accent} className="flex flex-col gap-1">
    <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
      // {label}
    </span>
    <span className="font-display text-2xl uppercase tabular-nums leading-none md:text-3xl">
      {value}
    </span>
  </BrutalCard>
);

export const StudioPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<readonly Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );
  const [reloadToken, setReloadToken] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<StatusFilter>('all');

  const [editTarget, setEditTarget] = useState<Video | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);

  // Pull every page of `/api/videos/mine` so the dashboard's KPIs and status
  // tabs see the entire archive — server caps each page at 48, and creators
  // typically have well under a few hundred uploads, so this stays cheap.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const collected: Video[] = [];
        for (let page = 1; page <= MAX_FETCH_PAGES; page += 1) {
          const result = await getMyVideos({ page, limit: PAGE_SIZE });
          if (cancelled) return;
          collected.push(...result.items);
          if (page >= result.totalPages) break;
        }
        if (!cancelled) setVideos(collected);
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as ExtendedAxiosError;
        setError({
          message:
            axiosErr.response?.data?.message ??
            axiosErr.message ??
            'Failed to load your videos',
          ...(axiosErr.requestId ? { requestId: axiosErr.requestId } : {}),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const statusCounts = useMemo(() => computeStatusCounts(videos), [videos]);

  const filteredVideos = useMemo<readonly Video[]>(() => {
    if (activeTab === 'all') return videos;
    return videos.filter((video) => video.status === activeTab);
  }, [videos, activeTab]);

  const kpis = useMemo<KpiValues>(() => {
    const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
    const totalLikes = videos.reduce((sum, video) => sum + video.likeCount, 0);
    return {
      totalVideos: videos.length,
      totalViews,
      totalLikes,
      subscribers: user?.subscriberCount ?? 0,
    };
  }, [videos, user?.subscriberCount]);

  const handleVideoUpdated = useCallback((updated: Video) => {
    setVideos((current) =>
      current.map((video) =>
        video.videoId === updated.videoId ? { ...video, ...updated } : video
      )
    );
  }, []);

  const handleVideoDeleted = useCallback((videoId: string) => {
    setVideos((current) => current.filter((video) => video.videoId !== videoId));
  }, []);

  const renderTableBody = () => {
    if (filteredVideos.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="border-2 border-ink p-0">
            <EmptyState
              title="// NO SIGNAL ON THIS TAB"
              description={
                activeTab === 'all'
                  ? 'upload your first video to get started.'
                  : `no videos with status ${activeTab.toUpperCase()}.`
              }
              action={
                activeTab === 'all' ? (
                  <BrutalButton onClick={() => navigate('/upload')}>
                    UPLOAD A VIDEO
                  </BrutalButton>
                ) : null
              }
            />
          </td>
        </tr>
      );
    }

    return filteredVideos.map((video) => {
      const thumbnail = resolveAssetUrl(video.thumbnailPath);
      const isReady = video.status === 'ready';
      return (
        <tr
          key={video.videoId}
          className="border-2 border-ink align-top hover:bg-acid/10"
        >
          <td className="border-r-2 border-ink p-2">
            <div className="aspect-video w-32 overflow-hidden border-2 border-ink bg-ink/80">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase text-bone/60">
                  // NO THUMB
                </div>
              )}
            </div>
          </td>

          <td className="border-r-2 border-ink p-2 align-top">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={video.status} />
                {video.visibility === 'unlisted' && (
                  <span className="border-2 border-ink bg-bone px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink">
                    UNLISTED
                  </span>
                )}
              </div>
              <span className="font-mono text-sm font-semibold uppercase">
                {video.title}
              </span>
              {video.status === 'failed' && video.processingError !== null && (
                <span className="font-mono text-[11px] text-orange">
                  // reason: {video.processingError}
                </span>
              )}
            </div>
          </td>

          <td className="border-r-2 border-ink p-2 text-right font-mono text-sm tabular-nums">
            {formatNumber(video.views)}
          </td>
          <td className="border-r-2 border-ink p-2 text-right font-mono text-sm tabular-nums">
            {formatNumber(video.likeCount)}
          </td>
          <td className="border-r-2 border-ink p-2 text-right font-mono text-sm tabular-nums">
            {formatNumber(video.commentCount)}
          </td>
          <td className="border-r-2 border-ink p-2 text-right font-mono text-xs uppercase">
            {formatRelativeDate(video.createdAt)}
          </td>

          <td className="p-2">
            <div className="flex flex-wrap justify-end gap-2">
              {isReady && (
                <BrutalButton
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/v/${video.videoId}`)}
                >
                  VIEW
                </BrutalButton>
              )}
              <BrutalButton
                size="sm"
                variant="outline"
                onClick={() => setEditTarget(video)}
              >
                EDIT
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="danger"
                onClick={() => setDeleteTarget(video)}
              >
                DELETE
              </BrutalButton>
            </div>
          </td>
        </tr>
      );
    });
  };

  const renderMobileCards = () => {
    if (filteredVideos.length === 0) {
      return (
        <EmptyState
          title="// NO SIGNAL ON THIS TAB"
          description={
            activeTab === 'all'
              ? 'upload your first video to get started.'
              : `no videos with status ${activeTab.toUpperCase()}.`
          }
          action={
            activeTab === 'all' ? (
              <BrutalButton onClick={() => navigate('/upload')}>
                UPLOAD A VIDEO
              </BrutalButton>
            ) : null
          }
        />
      );
    }

    return (
      <ul className="flex flex-col gap-3">
        {filteredVideos.map((video) => {
          const thumbnail = resolveAssetUrl(video.thumbnailPath);
          const isReady = video.status === 'ready';
          return (
            <li key={video.videoId}>
              <BrutalCard className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="aspect-video w-28 shrink-0 overflow-hidden border-2 border-ink bg-ink/80">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase text-bone/60">
                        // NO THUMB
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={video.status} />
                      {video.visibility === 'unlisted' && (
                        <span className="border-2 border-ink bg-bone px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink">
                          UNLISTED
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 font-mono text-sm font-semibold uppercase">
                      {video.title}
                    </span>
                    <span className="font-mono text-[11px] uppercase opacity-60">
                      {formatRelativeDate(video.createdAt)}
                    </span>
                  </div>
                </div>

                {video.status === 'failed' && video.processingError !== null && (
                  <p className="font-mono text-[11px] text-orange">
                    // reason: {video.processingError}
                  </p>
                )}

                <dl className="grid grid-cols-3 gap-2 border-2 border-ink p-2 text-center font-mono text-xs">
                  <div>
                    <dt className="opacity-60">VIEWS</dt>
                    <dd className="tabular-nums">{formatNumber(video.views)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">LIKES</dt>
                    <dd className="tabular-nums">{formatNumber(video.likeCount)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">COMMENTS</dt>
                    <dd className="tabular-nums">{formatNumber(video.commentCount)}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap justify-end gap-2">
                  {isReady && (
                    <BrutalButton
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/v/${video.videoId}`)}
                    >
                      VIEW
                    </BrutalButton>
                  )}
                  <BrutalButton
                    size="sm"
                    variant="outline"
                    onClick={() => setEditTarget(video)}
                  >
                    EDIT
                  </BrutalButton>
                  <BrutalButton
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteTarget(video)}
                  >
                    DELETE
                  </BrutalButton>
                </div>
              </BrutalCard>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">// FRAGMENT</span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // STUDIO // YOUR SIGNAL ARCHIVE
        </h1>
        <p className="font-mono text-xs uppercase opacity-70">
          {'>>'} manage every signal you've broadcast
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="TOTAL VIDEOS" value={String(kpis.totalVideos)} accent="acid" />
        <KpiCard label="TOTAL VIEWS" value={formatNumber(kpis.totalViews)} accent="electric" />
        <KpiCard label="TOTAL LIKES" value={formatNumber(kpis.totalLikes)} accent="magenta" />
        <KpiCard label="SUBSCRIBERS" value={formatNumber(kpis.subscribers)} accent="orange" />
      </div>

      <div
        role="tablist"
        aria-label="Filter videos by status"
        className="mb-4 flex flex-wrap items-center gap-2 border-b-2 border-ink pb-3 dark:border-bone"
      >
        {STATUS_FILTERS.map((status) => {
          const active = activeTab === status;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(status)}
              className={cn(
                'border-2 border-ink px-3 py-1 font-mono text-xs uppercase tracking-tight transition-none',
                active
                  ? 'bg-ink text-acid'
                  : 'bg-transparent text-ink hover:bg-ink hover:text-bone dark:text-bone'
              )}
            >
              [ {STATUS_LABEL[status]} {statusCounts[status]} ]
            </button>
          );
        })}
        <div className="ms-auto font-mono text-xs uppercase opacity-60">
          {filteredVideos.length} SHOWN
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBlock
            message={error.message}
            {...(error.requestId ? { requestId: error.requestId } : {})}
            onRetry={() => setReloadToken((value) => value + 1)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <AsciiSpinner label="LOADING ARCHIVE" />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full border-collapse border-2 border-ink font-mono text-sm">
              <thead className="bg-ink text-acid">
                <tr>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // THUMB
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // TITLE
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // VIEWS
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // LIKES
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // COMMENTS
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // UPLOADED
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>{renderTableBody()}</tbody>
            </table>
          </div>

          <div className="md:hidden">{renderMobileCards()}</div>
        </>
      )}

      <EditVideoModal
        open={editTarget !== null}
        video={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleVideoUpdated}
      />

      <DeleteVideoModal
        open={deleteTarget !== null}
        video={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleVideoDeleted}
      />
    </section>
  );
};

export default StudioPage;
