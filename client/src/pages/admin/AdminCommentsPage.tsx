import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { AdminComment, AdminCommentVideoRef } from '@shared/types/admin.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { ConfirmModal } from '../../components/admin/ConfirmModal.js';
import { Pagination } from '../../components/admin/Pagination.js';
import { BrutalButton } from '../../components/brutal/BrutalButton.js';
import { BrutalInput } from '../../components/brutal/BrutalInput.js';
import { AsciiSpinner } from '../../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../../components/feedback/EmptyState.js';
import { ErrorBlock } from '../../components/feedback/ErrorBlock.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import {
  adminDeleteComment,
  listAllComments,
} from '../../services/admin.service.js';
import { resolveAssetUrl } from '../../utils/constants.js';
import { formatRelativeDate } from '../../utils/formatDate.js';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const BODY_PREVIEW_LIMIT = 220;

const isVideoRef = (
  video: AdminComment['video']
): video is AdminCommentVideoRef => Boolean(video) && typeof video !== 'string';

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export const AdminCommentsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminComment[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );

  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [videoFilter, setVideoFilter] = useState<string>('');
  const debouncedVideo = useDebounce(videoFilter, SEARCH_DEBOUNCE_MS);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminComment | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedVideo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (debouncedVideo.trim()) params.videoId = debouncedVideo.trim();

    (async () => {
      try {
        const data = await listAllComments(params);
        if (cancelled) return;
        setItems(data.items);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as ExtendedAxiosError;
        setError({
          message:
            axiosErr.response?.data?.message ?? axiosErr.message ?? 'Failed to load comments',
          ...(axiosErr.requestId ? { requestId: axiosErr.requestId } : {}),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, debouncedVideo, reloadToken]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPendingActionId(deleteTarget._id);
    try {
      await adminDeleteComment(deleteTarget._id);
      setItems((current) =>
        current.map((comment) =>
          comment._id === deleteTarget._id
            ? { ...comment, isDeleted: true, body: '' }
            : comment
        )
      );
      toast.success('// COMMENT REMOVED');
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
          <td colSpan={5} className="border-2 border-ink p-0">
            <EmptyState
              title="// NO COMMENTS"
              description="adjust the filters to widen the search."
            />
          </td>
        </tr>
      );
    }

    return items.map((comment) => {
      const author = comment.author;
      const avatar = resolveAssetUrl(author?.avatarUrl ?? null);
      const videoRef = isVideoRef(comment.video) ? comment.video : null;
      const busy = pendingActionId === comment._id;
      return (
        <tr
          key={comment._id}
          className="border-2 border-ink align-top hover:bg-acid/10"
        >
          <td className="border-r-2 border-ink p-2 align-top">
            {comment.isDeleted ? (
              <span className="font-mono text-xs uppercase text-orange">
                // [REMOVED]
              </span>
            ) : (
              <p className="whitespace-pre-wrap font-mono text-sm">
                {truncate(comment.body, BODY_PREVIEW_LIMIT)}
              </p>
            )}
            {comment.isEdited && !comment.isDeleted && (
              <span className="ms-1 font-mono text-[10px] uppercase opacity-60">
                (edited)
              </span>
            )}
          </td>

          <td className="border-r-2 border-ink p-2 font-mono text-xs">
            {author ? (
              <div className="flex items-center gap-2">
                <div className="size-8 shrink-0 overflow-hidden border-2 border-ink bg-ink/80">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase text-bone/60">
                      --
                    </div>
                  )}
                </div>
                <Link to={`/c/${author.username}`} className="uppercase hover:underline">
                  @{author.username}
                </Link>
              </div>
            ) : (
              <span className="opacity-50">// removed</span>
            )}
          </td>

          <td className="border-r-2 border-ink p-2 font-mono text-xs">
            {videoRef ? (
              <Link
                to={`/v/${videoRef.videoId}`}
                className="line-clamp-2 uppercase hover:underline"
                title={videoRef.title}
              >
                {videoRef.title}
              </Link>
            ) : (
              <span className="opacity-50">// missing</span>
            )}
          </td>

          <td className="border-r-2 border-ink p-2 text-right font-mono text-xs uppercase">
            {formatRelativeDate(comment.createdAt)}
          </td>

          <td className="p-2">
            <div className="flex flex-wrap justify-end gap-2">
              {videoRef && (
                <BrutalButton
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/v/${videoRef.videoId}`)}
                >
                  VIEW
                </BrutalButton>
              )}
              <BrutalButton
                size="sm"
                variant="danger"
                disabled={comment.isDeleted || busy}
                onClick={() => setDeleteTarget(comment)}
              >
                {comment.isDeleted ? 'REMOVED' : 'DELETE'}
              </BrutalButton>
            </div>
          </td>
        </tr>
      );
    });
  };

  const totalLabel = useMemo(
    () => (loading ? 'LOADING...' : `${total} COMMENTS`),
    [loading, total]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">
          // FRAGMENT // CONTROL ROOM
        </span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // ADMIN // COMMENTS
        </h1>
        <p className="font-mono text-xs uppercase opacity-70">
          {'>>'} moderate every reply across the platform
        </p>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <BrutalInput
          label="SEARCH BODY"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="// keywords"
          prefix=">"
        />
        <BrutalInput
          label="VIDEO ID"
          type="search"
          value={videoFilter}
          onChange={(event) => setVideoFilter(event.target.value)}
          placeholder="// videoId or mongo _id"
          hint="paste a videoId to scope to one signal"
          prefix="#"
        />
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
          <AsciiSpinner label="LOADING COMMENTS" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse border-2 border-ink font-mono text-sm">
              <thead className="bg-ink text-acid">
                <tr>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // BODY
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // AUTHOR
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // VIDEO
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // POSTED
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
        title="DELETE COMMENT"
        destructive
        loading={pendingActionId !== null && pendingActionId === deleteTarget?._id}
        confirmLabel="DELETE"
        description={
          deleteTarget ? (
            <>
              {'>>'} the comment will be soft-deleted and its body wiped.
              counters on the parent video and thread will decrement.
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

export default AdminCommentsPage;
