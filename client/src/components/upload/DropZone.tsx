import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import toast from 'react-hot-toast';

import { formatDuration } from '../../utils/formatDuration.js';
import { cn } from '../../utils/classNames.js';

interface DropZoneProps {
  onFile: (file: File) => void;
  maxSizeMb: number;
  maxDurationSec: number;
  disabled?: boolean;
}

interface ProbedMeta {
  file: File;
  durationSec: number;
  sizeMb: number;
}

const BYTES_PER_MB = 1024 * 1024;

/**
 * Probes a video file in-memory using a hidden <video> element to read its
 * duration without uploading. Resolves the duration in seconds; rejects when
 * the browser cannot decode the metadata (corrupt or unsupported container).
 */
const probeFileDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Cannot read video metadata'));
    };
    video.src = objectUrl;
  });

export const DropZone = ({
  onFile,
  maxSizeMb,
  maxDurationSec,
  disabled = false,
}: DropZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [meta, setMeta] = useState<ProbedMeta | null>(null);
  const inputId = useId();

  const validateAndAccept = useCallback(
    async (file: File): Promise<void> => {
      if (disabled) return;

      if (!file.type.startsWith('video/')) {
        toast.error('// REJECTED // FILE MUST BE A VIDEO');
        return;
      }

      const sizeMb = file.size / BYTES_PER_MB;
      if (sizeMb > maxSizeMb) {
        toast.error(
          `// FILE TOO LARGE // ${sizeMb.toFixed(1)} MB exceeds ${maxSizeMb} MB limit`
        );
        return;
      }

      setIsProbing(true);
      try {
        const durationSec = await probeFileDuration(file);
        if (durationSec > maxDurationSec) {
          toast.error(
            `// VIDEO TOO LONG // ${Math.round(durationSec)}s exceeds ${maxDurationSec}s limit`
          );
          return;
        }
        setMeta({ file, durationSec, sizeMb });
        onFile(file);
      } catch {
        toast.error('// METADATA UNREADABLE // FILE MAY BE CORRUPT');
      } finally {
        setIsProbing(false);
      }
    },
    [disabled, maxSizeMb, maxDurationSec, onFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = event.dataTransfer.files?.[0];
      if (file) void validateAndAccept(file);
    },
    [disabled, validateAndAccept]
  );

  const handleBrowseChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void validateAndAccept(file);
      event.target.value = '';
    },
    [validateAndAccept]
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    },
    [openPicker]
  );

  const baseZoneClass =
    'flex flex-col items-center justify-center gap-3 min-h-70 border-4 border-dashed border-ink p-6 text-center font-mono uppercase select-none transition-colors';
  const stateClass = isDragging
    ? 'border-solid border-acid bg-acid/10'
    : 'bg-bone dark:bg-ink hover:bg-acid/5';
  const disabledClass = disabled
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer';

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drop a video file here or browse to upload"
        aria-disabled={disabled || undefined}
        aria-busy={isProbing || undefined}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(baseZoneClass, stateClass, disabledClass)}
      >
        <span className="font-display text-2xl tracking-tight md:text-3xl">
          {'>>'} DROP A VIDEO FILE HERE
        </span>
        <span className="text-sm">
          // OR{' '}
          <span className="bg-ink px-2 py-0.5 text-acid">[ BROWSE ]</span>
        </span>
        <span className="text-xs opacity-60">
          // MAX {Math.round(maxDurationSec / 60)} MIN // KEEP IT TIGHT
        </span>
        {isProbing && (
          <span className="mt-2 text-xs text-acid">
            {'>>'} READING METADATA...
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={handleBrowseChange}
        disabled={disabled}
      />

      {meta && (
        <dl className="grid grid-cols-1 gap-1 border-2 border-ink bg-bone p-3 font-mono text-xs uppercase text-ink dark:bg-ink dark:text-bone sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="opacity-60">// NAME</dt>
            <dd className="truncate text-right" title={meta.file.name}>
              {meta.file.name}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="opacity-60">// SIZE</dt>
            <dd className="tabular-nums">{meta.sizeMb.toFixed(2)} MB</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="opacity-60">// TYPE</dt>
            <dd>{meta.file.type || 'video/*'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="opacity-60">// DURATION</dt>
            <dd className="tabular-nums">{formatDuration(meta.durationSec)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
};

export default DropZone;
