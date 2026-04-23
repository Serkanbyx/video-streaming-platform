import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { VIDEO_SORT_KEYS, type VideoSortKey } from '@shared/constants/enums.js';
import type { PaginatedResult } from '@shared/types/api.js';
import type { Video } from '@shared/types/video.js';

import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalInput } from '../components/brutal/BrutalInput.js';
import { AsciiSpinner } from '../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../components/feedback/EmptyState.js';
import { ErrorBlock } from '../components/feedback/ErrorBlock.js';
import { VideoGrid } from '../components/video/VideoGrid.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { listVideos } from '../services/video.service.js';
import { cn } from '../utils/classNames.js';
import type { ExtendedAxiosError } from '../api/axios.js';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 12;
const POPULAR_TAGS_LIMIT = 12;

const SORT_LABELS: Record<VideoSortKey, string> = {
  new: 'NEW',
  top: 'TOP',
  liked: 'LIKED',
};

const isSortKey = (value: string | null): value is VideoSortKey =>
  value !== null && (VIDEO_SORT_KEYS as readonly string[]).includes(value);

const parsePage = (raw: string | null): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

const computePopularTags = (videos: readonly Video[]): readonly string[] => {
  const counts = new Map<string, number>();
  for (const video of videos) {
    for (const tag of video.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, POPULAR_TAGS_LIMIT)
    .map(([tag]) => tag);
};

export const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') ?? '';
  const urlTag = searchParams.get('tag') ?? '';
  const urlSort: VideoSortKey = isSortKey(searchParams.get('sort'))
    ? (searchParams.get('sort') as VideoSortKey)
    : 'new';
  const urlPage = parsePage(searchParams.get('page'));

  const [searchInput, setSearchInput] = useState<string>(urlQuery);
  const debouncedSearch = useDebounce<string>(searchInput, SEARCH_DEBOUNCE_MS);

  const [data, setData] = useState<PaginatedResult<Video> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  // Cache of tags collected from the very first unfiltered fetch so the chip
  // bar stays stable while the user is filtering — preventing the tag list
  // from collapsing to the ones present in the current filtered result.
  const popularTagsRef = useRef<readonly string[]>([]);
  const [popularTags, setPopularTags] = useState<readonly string[]>([]);

  // Reflect URL → input on back/forward navigation, but never clobber what
  // the user is actively typing (would feel like the field "snaps back").
  useEffect(() => {
    setSearchInput((current) => (current === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  // Push the debounced query into the URL. Resets to page 1 whenever the
  // search criteria changes so the user never lands on an out-of-range page.
  // Uses the functional setter form so we don't have to depend on the
  // `searchParams` reference, which changes on every URL update and would
  // otherwise re-fire this effect for every unrelated navigation.
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === urlQuery) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (trimmed) next.set('q', trimmed);
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [debouncedSearch, urlQuery, setSearchParams]);

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void): void => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      });
    },
    [setSearchParams]
  );

  const handleSortChange = useCallback(
    (sort: VideoSortKey) => {
      updateParams((next) => {
        if (sort === 'new') next.delete('sort');
        else next.set('sort', sort);
        next.delete('page');
      });
    },
    [updateParams]
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      updateParams((next) => {
        if (next.get('tag') === tag) next.delete('tag');
        else next.set('tag', tag);
        next.delete('page');
      });
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams((next) => {
        if (page <= 1) next.delete('page');
        else next.set('page', String(page));
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [updateParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listVideos({
      q: urlQuery || undefined,
      tag: urlTag || undefined,
      sort: urlSort,
      page: urlPage,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);

        // Seed the popular-tag list once, on the first unfiltered response.
        if (
          popularTagsRef.current.length === 0 &&
          !urlQuery &&
          !urlTag &&
          urlSort === 'new'
        ) {
          const tags = computePopularTags(result.items);
          popularTagsRef.current = tags;
          setPopularTags(tags);
        }
      })
      .catch((err: ExtendedAxiosError) => {
        if (cancelled) return;
        setError({
          message:
            err.response?.data?.message ??
            err.message ??
            'Failed to load videos',
          ...(err.requestId ? { requestId: err.requestId } : {}),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlQuery, urlTag, urlSort, urlPage, reloadToken]);

  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? urlPage;
  const items = data?.items ?? [];

  const pageIndicator = useMemo(() => {
    const pad = (value: number): string => value.toString().padStart(2, '0');
    return `PAGE ${pad(currentPage)} / ${pad(Math.max(totalPages, 1))}`;
  }, [currentPage, totalPages]);

  const showSpinner = loading && !data;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.4em] opacity-60">
          // FRAGMENT // VIDEO SIGNAL
        </p>
        <h1 className="font-display text-4xl font-bold uppercase leading-[0.9] tracking-tight md:text-6xl lg:text-7xl">
          WATCH WHAT
          <br />
          <span className="text-magenta">BREAKS</span> THE FRAME
        </h1>
        <p className="mt-2 font-mono text-sm uppercase opacity-70">
          {'>>'} RAW UPLOADS // ASYMMETRIC GRID // ZERO ALGORITHM
        </p>
      </header>

      <div className="mb-6">
        <BrutalInput
          label="SEARCH"
          type="search"
          prefix=">>"
          value={searchInput}
          placeholder="title, tags, channel..."
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search videos"
        />
      </div>

      {popularTags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase opacity-60">
            // TAGS:
          </span>
          {popularTags.map((tag) => {
            const active = urlTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                aria-pressed={active}
                className={cn(
                  'border-2 border-ink px-2 py-0.5 font-mono text-xs uppercase tracking-tight transition-none',
                  active
                    ? 'bg-acid text-ink shadow-(--shadow-brutal-sm)'
                    : 'bg-transparent text-ink hover:bg-ink hover:text-bone dark:text-bone'
                )}
              >
                #{tag}
              </button>
            );
          })}
          {urlTag && !popularTags.includes(urlTag) && (
            <button
              type="button"
              onClick={() => handleTagToggle(urlTag)}
              aria-pressed
              className="border-2 border-ink bg-acid px-2 py-0.5 font-mono text-xs uppercase tracking-tight text-ink shadow-(--shadow-brutal-sm)"
            >
              #{urlTag} x
            </button>
          )}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Sort videos"
        className="mb-6 flex flex-wrap items-center gap-2 border-b-2 border-ink pb-3 dark:border-bone"
      >
        {VIDEO_SORT_KEYS.map((sort) => {
          const active = urlSort === sort;
          return (
            <button
              key={sort}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSortChange(sort)}
              className={cn(
                'border-2 border-ink px-3 py-1 font-mono text-xs uppercase tracking-tight transition-none',
                active
                  ? 'bg-ink text-acid'
                  : 'bg-transparent text-ink hover:bg-ink hover:text-bone dark:text-bone'
              )}
            >
              [ {SORT_LABELS[sort]} ]
            </button>
          );
        })}

        <div className="ms-auto font-mono text-xs uppercase opacity-60">
          {data ? `${data.total} RESULTS` : '...'}
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

      {showSpinner ? (
        <div className="flex justify-center py-20">
          <AsciiSpinner label="LOADING SIGNAL" />
        </div>
      ) : items.length === 0 && !error ? (
        <EmptyState
          title="// NO SIGNAL"
          description="try a different query"
        />
      ) : (
        <div aria-busy={loading || undefined}>
          <VideoGrid videos={items} autoPlayCount={4} />
        </div>
      )}

      {data && data.totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex flex-wrap items-center justify-center gap-3 font-mono"
        >
          <BrutalButton
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
          >
            {'< PREV'}
          </BrutalButton>
          <span className="px-2 text-sm uppercase tracking-widest tabular-nums">
            {pageIndicator}
          </span>
          <BrutalButton
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
          >
            {'NEXT >'}
          </BrutalButton>
        </nav>
      )}
    </section>
  );
};

export default HomePage;
