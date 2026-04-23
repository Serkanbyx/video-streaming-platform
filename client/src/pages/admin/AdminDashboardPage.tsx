import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { VIDEO_STATUSES, type VideoStatus } from '@shared/constants/enums.js';
import type { DashboardStats } from '@shared/types/admin.js';
import type { Video, VideoAuthorRef } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { DiskUsageWidget } from '../../components/admin/DiskUsageWidget.js';
import { BrutalCard } from '../../components/brutal/BrutalCard.js';
import { AsciiSpinner } from '../../components/feedback/AsciiSpinner.js';
import { ErrorBlock } from '../../components/feedback/ErrorBlock.js';
import { getStats } from '../../services/admin.service.js';
import { formatViews } from '../../utils/formatViews.js';

const STATUS_BAR_SEGMENTS = 24;

const STATUS_TONE: Record<VideoStatus, string> = {
  ready: 'text-acid',
  processing: 'text-electric',
  pending: 'text-bone',
  failed: 'text-magenta',
};

interface KpiCardProps {
  label: string;
  value: string;
  accent: 'acid' | 'magenta' | 'electric' | 'orange';
  hint?: string;
}

const KpiCard = ({ label, value, accent, hint }: KpiCardProps) => (
  <BrutalCard accent={accent} className="flex flex-col gap-1">
    <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
      // {label}
    </span>
    <span className="font-display text-2xl uppercase tabular-nums leading-none md:text-3xl">
      {value}
    </span>
    {hint && (
      <span className="font-mono text-[11px] uppercase opacity-60">{hint}</span>
    )}
  </BrutalCard>
);

const buildBar = (count: number, max: number): string => {
  if (max <= 0) return '░'.repeat(STATUS_BAR_SEGMENTS);
  const filled = Math.round((count / max) * STATUS_BAR_SEGMENTS);
  return '█'.repeat(filled) + '░'.repeat(STATUS_BAR_SEGMENTS - filled);
};

const resolveAuthor = (author: Video['author']): VideoAuthorRef | null => {
  if (!author || typeof author === 'string') return null;
  return author;
};

export const AdminDashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await getStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as ExtendedAxiosError;
        setError({
          message:
            axiosErr.response?.data?.message ??
            axiosErr.message ??
            'Failed to load dashboard',
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

  const maxStatusCount = useMemo(() => {
    if (!stats) return 0;
    return VIDEO_STATUSES.reduce(
      (max, key) => Math.max(max, stats.videosByStatus[key] ?? 0),
      0
    );
  }, [stats]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">
          // FRAGMENT // CONTROL ROOM
        </span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // ADMIN // DASHBOARD
        </h1>
        <p className="font-mono text-xs uppercase opacity-70">
          {'>>'} aggregate signal &amp; storage telemetry
        </p>
      </header>

      {error && (
        <div className="mb-6">
          <ErrorBlock
            message={error.message}
            {...(error.requestId ? { requestId: error.requestId } : {})}
            onRetry={() => setReloadToken((value) => value + 1)}
          />
        </div>
      )}

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <AsciiSpinner label="LOADING TELEMETRY" />
        </div>
      ) : stats ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="USERS"
              value={formatViews(stats.totalUsers)}
              accent="acid"
              hint={`+${stats.newUsersLast7Days} LAST 7d`}
            />
            <KpiCard label="VIDEOS" value={formatViews(stats.totalVideos)} accent="electric" />
            <KpiCard label="VIEWS" value={formatViews(stats.totalViews)} accent="magenta" />
            <KpiCard
              label="COMMENTS"
              value={formatViews(stats.totalComments)}
              accent="orange"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <BrutalCard className="flex flex-col gap-3 md:col-span-2">
              <header className="flex items-center justify-between">
                <h2 className="font-mono text-sm uppercase tracking-widest">
                  // STATUS BREAKDOWN
                </h2>
                <span className="font-mono text-[10px] uppercase opacity-60">
                  TOTAL · {stats.totalVideos}
                </span>
              </header>

              <div className="flex flex-col gap-2 font-mono text-xs">
                {VIDEO_STATUSES.map((status) => {
                  const count = stats.videosByStatus[status] ?? 0;
                  return (
                    <div
                      key={status}
                      className="grid grid-cols-[110px_1fr_60px] items-center gap-3"
                    >
                      <span className="uppercase opacity-70">{status}</span>
                      <span
                        aria-hidden="true"
                        className={`select-none truncate text-base leading-none ${STATUS_TONE[status]}`}
                      >
                        {buildBar(count, maxStatusCount)}
                      </span>
                      <span className="text-right tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </BrutalCard>

            <DiskUsageWidget />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BrutalCard className="flex flex-col gap-3">
              <header>
                <h2 className="font-mono text-sm uppercase tracking-widest">
                  // RECENT ACTIVITY
                </h2>
                <p className="font-mono text-[11px] uppercase opacity-60">
                  {'>>'} 7-day rolling window
                </p>
              </header>
              <p className="font-display text-4xl uppercase tabular-nums">
                +{stats.newUsersLast7Days}
              </p>
              <p className="font-mono text-xs uppercase opacity-70">
                NEW USERS JOINED THE SIGNAL
              </p>
            </BrutalCard>

            <BrutalCard className="flex flex-col gap-3">
              <header>
                <h2 className="font-mono text-sm uppercase tracking-widest">
                  // TOP 5 VIDEOS BY VIEWS
                </h2>
              </header>
              {stats.topVideosByViews.length === 0 ? (
                <p className="font-mono text-xs uppercase opacity-70">
                  // no public-ready videos yet
                </p>
              ) : (
                <ol className="flex flex-col gap-2 font-mono text-sm">
                  {stats.topVideosByViews.map((video, index) => {
                    const author = resolveAuthor(video.author);
                    return (
                      <li
                        key={video.videoId}
                        className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-1 last:border-b-0 dark:border-bone/10"
                      >
                        <span className="flex min-w-0 flex-1 items-baseline gap-2">
                          <span className="w-5 shrink-0 text-acid tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <Link
                            to={`/v/${video.videoId}`}
                            className="truncate uppercase hover:underline"
                            title={video.title}
                          >
                            {video.title}
                          </Link>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3 text-xs uppercase opacity-70">
                          {author && <span>@{author.username}</span>}
                          <span className="tabular-nums">
                            {formatViews(video.views)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </BrutalCard>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default AdminDashboardPage;
