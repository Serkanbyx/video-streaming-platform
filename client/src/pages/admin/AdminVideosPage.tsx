import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { VIDEO_STATUSES, type VideoStatus } from '@shared/constants/enums.js';
import type { Video, VideoAuthorRef } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { ConfirmModal } from '../../components/admin/ConfirmModal.js';
import { Pagination } from '../../components/admin/Pagination.js';
import { BrutalButton } from '../../components/brutal/BrutalButton.js';
import { BrutalInput } from '../../components/brutal/BrutalInput.js';
import { AsciiSpinner } from '../../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../../components/feedback/EmptyState.js';
import { ErrorBlock } from '../../components/feedback/ErrorBlock.js';
import { StatusBadge } from '../../components/studio/StatusBadge.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import {
  adminDeleteVideo,
  flagVideo,
  listAllVideos,
} from '../../services/admin.service.js';
import { resolveAssetUrl } from '../../utils/constants.js';
import { formatRelativeDate } from '../../utils/formatDate.js';
import { formatViews } from '../../utils/formatViews.js';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_FILTERS: readonly (VideoStatus | 'all')[] = ['all', ...VIDEO_STATUSES];
const FLAG_FILTERS = ['all', 'flagged', 'clean'] as const;
type FlagFilter = (typeof FLAG_FILTERS)[number];

const FLAG_LABEL: Record<FlagFilter, string> = {
  all: 'all',
  flagged: 'flagged only',
  clean: 'clean only',
};

const resolveAuthor = (author: Video['author']): VideoAuthorRef | string =>
  author ?? '';

const isAuthorObj = (
  author: VideoAuthorRef | string | null
): author is VideoAuthorRef => Boolean(author) && typeof author !== 'string';

export const AdminVideosPage = () => {
  const [items, setItems] = useState<Video[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );

  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<VideoStatus | 'all'>('all');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, flagFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (statusFilter !== 'all') params.status = statusFilter;
    if (flagFilter === 'flagged') params.isFlagged = true;
    if (flagFilter === 'clean') params.isFlagged = false;

    (async () => {
      try {
        const data = await listAllVideos(params);
        if (cancelled) return;
        setItems(data.items);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as ExtendedAxiosError;
        setError({
          message:
            axiosErr.response?.data?.message ?? axiosErr.message ?? 'Failed to load videos',
          ...(axiosErr.requestId ? { requestId: axiosErr.requestId } : {}),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, statusFilter, flagFilter, reloadToken]);

  const handleToggleFlag = async (video: Video) => {
    setPendingActionId(video.videoId);
    try {
      const result = await flagVideo(video.videoId, !video.isFlagged);
      setItems((current) =>
        current.map((entry) =>
          entry.videoId === video.videoId
            ? { ...entry, isFlagged: result.isFlagged }
            : entry
        )
      );
      toast.success(
        result.isFlagged
          ? `// FLAGGED // ${video.videoId}`
          : `// CLEARED // ${video.videoId}`
      );
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      toast.error(
        `// FLAG FAILED // ${axiosErr.response?.data?.message ?? axiosErr.message ?? 'unknown'}`
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPendingActionId(deleteTarget.videoId);
    try {
      await adminDeleteVideo(deleteTarget.videoId);
      setItems((current) =>
        current.filter((entry) => entry.videoId !== deleteTarget.videoId)
      );
      setTotal((value) => Math.max(0, value - 1));
      toast.success(`// SIGNAL ERASED // ${deleteTarget.videoId}`);
      setDeleteTarget(null);
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      toast.error(
        `// DELETE FAILED // ${axiosErr.response?.data?.message ?? axiosErr.message ?? 'unknown'}`
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const renderTableBody = () => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={8} className="border-2 border-ink p-0">
            <EmptyState
              title="// NO VIDEOS"
              description="adjust the filters to widen the search."
            />
          </td>
        </tr>
      );
    }

    return items.map((video) => {
      const thumbnail = resolveAssetUrl(video.thumbnailPath);
      const author = isAuthorObj(resolveAuthor(video.author))
        ? (video.author as VideoAuthorRef)
        : null;
      const busy = pendingActionId === video.videoId;
      return (
        <tr
          key={video.videoId}
          className="border-2 border-ink align-top hover:bg-acid/10"
        >
          <td className="border-r-2 border-ink p-2">
            <Link
              to={`/v/${video.videoId}`}
              className="block aspect-video w-32 overflow-hidden border-2 border-ink bg-ink/80"
            >
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
            </Link>
          </td>
          <td className="border-r-2 border-ink p-2 align-top">
            <div className="flex flex-col gap-1">
              <Link
                to={`/v/${video.videoId}`}
                className="line-clamp-2 font-mono text-sm font-semibold uppercase hover:underline"
              >
                {video.title}
              </Link>
              <span className="font-mono text-[11px] uppercase opacity-60">
                ID · {video.videoId}
              </span>
              {video.status === 'failed' && video.processingError !== null && (
                <span className="font-mono text-[11px] text-orange">
                  // {video.processingError}
                </span>
              )}
            </div>
          </td>
          <td className="border-r-2 border-ink p-2 font-mono text-xs uppercase">
            {author ? (
              <Link
                to={`/c/${author.username}`}
                className="hover:underline"
                title={author.displayName}
              >
                @{author.username}
              </Link>
            ) : (
              <span className="opacity-50">// removed</span>
            )}
          </td>
          <td className="border-r-2 border-ink p-2">
            <div className="flex flex-col gap-1">
              <StatusBadge status={video.status} />
              {video.visibility === 'unlisted' && (
                <span className="border-2 border-ink bg-bone px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink">
                  UNLISTED
                </span>
              )}
            </div>
          </td>
          <td className="border-r-2 border-ink p-2 text-right font-mono text-sm tabular-nums">
            {formatViews(video.views)}
          </td>
          <td className="border-r-2 border-ink p-2 text-center">
            {video.isFlagged ? (
              <span
                aria-label="Flagged for review"
                className="inline-block border-2 border-orange bg-orange/20 px-2 py-0.5 font-mono text-[10px] uppercase text-orange"
              >
                ! FLAGGED
              </span>
            ) : (
              <span aria-hidden="true" className="font-mono text-xs opacity-30">
                --
              </span>
            )}
          </td>
          <td className="border-r-2 border-ink p-2 text-right font-mono text-xs uppercase">
            {formatRelativeDate(video.createdAt)}
          </td>
          <td className="p-2">
            <div className="flex flex-wrap justify-end gap-2">
              <BrutalButton
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleToggleFlag(video)}
              >
                {video.isFlagged ? 'UNFLAG' : 'FLAG'}
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="danger"
                disabled={busy}
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

  const totalLabel = useMemo(
    () => (loading ? 'LOADING...' : `${total} VIDEOS`),
    [loading, total]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">
          // FRAGMENT // CONTROL ROOM
        </span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // ADMIN // VIDEOS
        </h1>
        <p className="font-mono text-xs uppercase opacity-70">
          {'>>'} every signal in the archive
        </p>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <BrutalInput
          label="SEARCH TITLE"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="// search title"
          prefix=">"
        />

        <div className="flex flex-col gap-1 font-mono">
          <label
            htmlFor="admin-videos-status"
            className="text-xs uppercase tracking-tight text-ink dark:text-bone"
          >
            // STATUS
          </label>
          <select
            id="admin-videos-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as VideoStatus | 'all')}
            className="border-2 border-ink bg-bone p-2 font-mono text-sm uppercase text-ink dark:bg-ink dark:text-bone"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 font-mono">
          <label
            htmlFor="admin-videos-flag"
            className="text-xs uppercase tracking-tight text-ink dark:text-bone"
          >
            // FLAG
          </label>
          <select
            id="admin-videos-flag"
            value={flagFilter}
            onChange={(event) => setFlagFilter(event.target.value as FlagFilter)}
            className="border-2 border-ink bg-bone p-2 font-mono text-sm uppercase text-ink dark:bg-ink dark:text-bone"
          >
            {FLAG_FILTERS.map((value) => (
              <option key={value} value={value}>
                {FLAG_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="font-mono text-xs uppercase opacity-60 md:pb-2">
          {totalLabel}
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

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <AsciiSpinner label="LOADING VIDEOS" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-275 border-collapse border-2 border-ink font-mono text-sm">
              <thead className="bg-ink text-acid">
                <tr>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // THUMB
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // TITLE
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // AUTHOR
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // STATUS
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // VIEWS
                  </th>
                  <th className="border-2 border-ink p-2 text-center text-xs uppercase">
                    // FLAG
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

          <div className="mt-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              disabled={loading}
            />
          </div>
        </>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="DELETE VIDEO"
        destructive
        loading={pendingActionId !== null && pendingActionId === deleteTarget?.videoId}
        confirmLabel="DELETE FOREVER"
        acknowledgeLabel="I UNDERSTAND THIS IS PERMANENT"
        description={
          deleteTarget ? (
            <>
              {'>>'} this will erase the video file, comments, likes and views
              for <strong className="font-bold">{deleteTarget.title}</strong>.
              cannot be undone.
            </>
          ) : (
            ''
          )
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
};

export default AdminVideosPage;
