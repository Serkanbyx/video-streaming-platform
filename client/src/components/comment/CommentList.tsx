import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Comment } from '@shared/types/comment.js';

import { useAuth } from '../../context/AuthContext.js';
import * as commentService from '../../services/comment.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';
import { ErrorBlock } from '../feedback/ErrorBlock.js';

import { CommentForm } from './CommentForm.js';
import { CommentItem } from './CommentItem.js';

interface CommentListProps {
  videoId: string;
}

const PAGE_SIZE = 10;

export const CommentList = ({ videoId }: CommentListProps) => {
  const { isAuthenticated } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean): Promise<void> => {
      const setBusy = replace ? setLoading : setLoadingMore;
      setBusy(true);
      setError(null);
      try {
        const result = await commentService.listForVideo(videoId, {
          page: nextPage,
          limit: PAGE_SIZE,
        });
        setComments((current) =>
          replace
            ? result.items
            : // Filter out duplicates that can sneak in if the user posted a
              // new comment while a "load more" request was in flight.
              [...current, ...result.items.filter((item) => !current.some((c) => c._id === item._id))]
        );
        setPage(result.page);
        setTotalPages(result.totalPages);
        setTotal(result.total);
      } catch (err) {
        const axiosErr = err as ExtendedAxiosError;
        setError({
          message:
            axiosErr.response?.data?.message ??
            axiosErr.message ??
            'Failed to load comments',
          ...(axiosErr.requestId ? { requestId: axiosErr.requestId } : {}),
        });
      } finally {
        setBusy(false);
      }
    },
    [videoId]
  );

  useEffect(() => {
    setComments([]);
    setPage(1);
    setTotalPages(1);
    setTotal(0);
    void loadPage(1, true);
  }, [loadPage]);

  const handleLoadMore = (): void => {
    if (page >= totalPages || loadingMore) return;
    void loadPage(page + 1, false);
  };

  const handleNewComment = (created: Comment): void => {
    setComments((current) => [created, ...current]);
    setTotal((value) => value + 1);
  };

  const handleUpdated = (updated: Comment): void => {
    setComments((current) =>
      current.map((item) => (item._id === updated._id ? updated : item))
    );
  };

  const handleDeleted = (commentId: string): void => {
    setComments((current) =>
      current.map((item) =>
        item._id === commentId ? { ...item, isDeleted: true, body: '' } : item
      )
    );
  };

  const headerCount = useMemo(() => total.toLocaleString(), [total]);

  return (
    <section aria-label="Comments" className="flex flex-col gap-4">
      <header className="flex items-center justify-between border-b-2 border-ink pb-2 dark:border-bone">
        <h2 className="font-display text-xl uppercase tracking-tight md:text-2xl">
          // COMMENTS // {headerCount}
        </h2>
        <span className="font-mono text-xs uppercase opacity-60">
          {'-->'}
        </span>
      </header>

      {isAuthenticated ? (
        <CommentForm videoId={videoId} onSubmitted={handleNewComment} />
      ) : (
        <p className="border-2 border-dashed border-ink bg-bone p-3 font-mono text-xs uppercase tracking-tight opacity-70 dark:bg-ink">
          // LOGIN TO BROADCAST A COMMENT
        </p>
      )}

      {error && (
        <ErrorBlock
          message={error.message}
          {...(error.requestId ? { requestId: error.requestId } : {})}
          onRetry={() => loadPage(1, true)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <AsciiSpinner label="LOADING COMMENTS" />
        </div>
      ) : comments.length === 0 && !error ? (
        <p className="border-2 border-dashed border-ink bg-bone p-4 text-center font-mono text-xs uppercase tracking-widest opacity-60 dark:bg-ink">
          // NO TRANSMISSIONS YET
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment._id}>
              <CommentItem
                comment={comment}
                videoId={videoId}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            </li>
          ))}
        </ul>
      )}

      {page < totalPages && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="border-2 border-ink bg-transparent px-4 py-1 font-mono text-xs uppercase tracking-tight text-ink hover:bg-ink hover:text-bone disabled:opacity-50 dark:text-bone"
          >
            [ {loadingMore ? 'LOADING...' : 'LOAD MORE'} ]
          </button>
        </div>
      )}
    </section>
  );
};

export default CommentList;
