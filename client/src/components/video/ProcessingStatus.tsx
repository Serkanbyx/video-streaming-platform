import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { VideoStatusPayload } from '@shared/types/video.js';
import type { VideoStatus } from '@shared/constants/enums.js';

import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalBadge } from '../brutal/BrutalBadge.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';
import { getStatus } from '../../services/video.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';

interface ProcessingStatusProps {
  videoId: string;
  onRetry: () => void;
}

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_LOG_LINES = 12;

const FAUX_LOG_LINES = [
  '[ffmpeg] probing container...',
  '[ffmpeg] codec=h264 width=1920 height=1080',
  '[hls] segmenting -> 1080p/segment_000.ts',
  '[hls] segmenting -> 720p/segment_000.ts',
  '[hls] segmenting -> 480p/segment_000.ts',
  '[hls] manifest -> master.m3u8',
  '[storage] uploading variants...',
  '[storage] writing thumbnail.jpg',
  '[db] persisting metadata...',
  '[worker] heartbeat...',
  '[worker] crunching frames...',
  '[worker] frames=1284 dropped=0',
] as const;

const formatTimestamp = (): string => {
  const now = new Date();
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

export const ProcessingStatus = ({ videoId, onRetry }: ProcessingStatusProps) => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<VideoStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<readonly string[]>([
    `[${formatTimestamp()}] >> queued ${videoId}`,
  ]);
  const startedAtRef = useRef<number>(Date.now());

  // Poll status until terminal (`ready` / `failed`) or until the 5-minute
  // ceiling — at which point we surface a soft timeout instead of polling
  // forever and silently burning request budget.
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const tick = async (): Promise<void> => {
      try {
        const result = await getStatus(videoId);
        if (cancelled) return;
        setPayload(result);
        setError(null);

        if (result.status === 'ready' || result.status === 'failed') return;

        if (Date.now() - startedAtRef.current >= POLL_TIMEOUT_MS) {
          setError('// TIMEOUT // SIGNAL TOOK TOO LONG');
          return;
        }
        timeoutId = window.setTimeout(() => {
          void tick();
        }, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as ExtendedAxiosError;
        setError(
          axiosErr.response?.data?.message ??
            axiosErr.message ??
            'Status check failed'
        );
        timeoutId = window.setTimeout(() => {
          void tick();
        }, POLL_INTERVAL_MS);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [videoId]);

  // Decorative log stream — appends a synthetic line every interval while in
  // a non-terminal state. Purely cosmetic; keeps the user feeling like work
  // is happening even when the backend status hasn't flipped yet.
  useEffect(() => {
    if (payload?.status === 'ready' || payload?.status === 'failed') return;

    const id = window.setInterval(() => {
      setLogLines((current) => {
        const nextLine = FAUX_LOG_LINES[current.length % FAUX_LOG_LINES.length];
        const stamped = `[${formatTimestamp()}] ${nextLine}`;
        const next = [...current, stamped];
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [payload?.status]);

  const status: VideoStatus = payload?.status ?? 'pending';

  const renderBanner = () => {
    if (status === 'pending') {
      return (
        <div className="flex items-center gap-3 border-2 border-ink bg-bone p-4 font-mono text-ink dark:bg-ink dark:text-bone">
          <BrutalBadge tone="ink">PENDING</BrutalBadge>
          <span className="text-sm uppercase opacity-80">// queued</span>
        </div>
      );
    }
    if (status === 'processing') {
      return (
        <div className="flex flex-wrap items-center gap-3 border-2 border-electric bg-bone p-4 font-mono text-ink dark:bg-ink dark:text-bone">
          <BrutalBadge tone="electric">PROCESSING</BrutalBadge>
          <span className="text-sm uppercase">
            // FFMPEG IS CRUNCHING THE SIGNAL
          </span>
          <AsciiSpinner label="ENCODING" />
        </div>
      );
    }
    if (status === 'ready') {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-acid bg-acid/20 p-4 font-mono text-ink">
          <div className="flex items-center gap-3">
            <BrutalBadge tone="acid">READY</BrutalBadge>
            <span className="text-sm uppercase">// LIVE {'-->'}</span>
          </div>
          <BrutalButton onClick={() => navigate(`/v/${videoId}`)}>
            WATCH NOW
          </BrutalButton>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 border-2 border-orange bg-bone p-4 font-mono text-ink dark:bg-ink dark:text-bone">
        <div className="flex items-center gap-3">
          <BrutalBadge tone="orange">FAILED</BrutalBadge>
          <span className="text-sm uppercase">// SIGNAL LOST</span>
        </div>
        {payload?.processingError && (
          <p className="text-xs opacity-80">{payload.processingError}</p>
        )}
        <div>
          <BrutalButton variant="danger" size="sm" onClick={onRetry}>
            TRY AGAIN
          </BrutalButton>
        </div>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      {renderBanner()}

      {error && status !== 'failed' && (
        <p
          role="status"
          className="border-2 border-orange bg-bone p-2 font-mono text-xs uppercase text-orange dark:bg-ink"
        >
          // STATUS POLL SOFT-FAIL: {error} // RETRYING...
        </p>
      )}

      <div
        aria-hidden="true"
        className="border-2 border-ink bg-ink p-3 font-mono text-xs leading-relaxed text-acid"
      >
        <div className="mb-2 flex items-center justify-between text-bone/80">
          <span>// LOG STREAM //</span>
          <span className="opacity-60">tail -f /var/log/fragment.log</span>
        </div>
        <ul className="flex flex-col gap-0.5">
          {logLines.map((line, index) => (
            <li key={`${index}-${line}`} className="truncate">
              {'>'} {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ProcessingStatus;
