import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import toast from 'react-hot-toast';

import {
  createVideoSchema,
  type CreateVideoInput,
} from '@shared/schemas/video.schema.js';
import { VIDEO_VISIBILITIES, type VideoVisibility } from '@shared/constants/enums.js';

import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../components/brutal/BrutalDivider.js';
import { BrutalInput } from '../components/brutal/BrutalInput.js';
import { DropZone } from '../components/upload/DropZone.js';
import { ProgressBar } from '../components/upload/ProgressBar.js';
import { ProcessingStatus } from '../components/video/ProcessingStatus.js';
import { uploadVideo } from '../services/video.service.js';
import { useUploadProgress } from '../hooks/useUploadProgress.js';
import { cn } from '../utils/classNames.js';
import type { ExtendedAxiosError } from '../api/axios.js';

const DESCRIPTION_MAX = 5000;
const TAG_MAX = 24;
const TAGS_MAX_COUNT = 8;
const TITLE_MIN = 3;
const TITLE_MAX = 120;

const DEFAULT_MAX_SIZE_MB = 100;
const DEFAULT_MAX_DURATION_SEC = 120;

interface FormState {
  title: string;
  description: string;
  tagInput: string;
  tags: string[];
  visibility: VideoVisibility;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  tagInput: '',
  tags: [],
  visibility: 'public',
};

type FormErrors = Partial<Record<'title' | 'description' | 'tags' | 'visibility', string>>;

const parseEnvNumber = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Normalises a raw tag candidate the same way the shared Zod schema does
 * (trim + lowercase + dash/underscore charset). Returning `null` signals the
 * caller to reject the chip without polluting state.
 */
const normaliseTag = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (trimmed.length > TAG_MAX) return null;
  if (!/^[a-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
};

export const UploadPage = () => {
  const maxSizeMb = useMemo(
    () => parseEnvNumber(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB, DEFAULT_MAX_SIZE_MB),
    []
  );
  const maxDurationSec = useMemo(
    () =>
      parseEnvNumber(
        import.meta.env.VITE_MAX_VIDEO_DURATION_SECONDS,
        DEFAULT_MAX_DURATION_SEC
      ),
    []
  );

  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);

  const { progress, isUploading, start, reset: resetProgress } = useUploadProgress();

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      if (key in errors) {
        setErrors((current) => ({ ...current, [key as keyof FormErrors]: undefined }));
      }
    },
    [errors]
  );

  const handleFileAccepted = useCallback((picked: File) => {
    setFile(picked);
    if (!form.title.trim()) {
      const stem = picked.name.replace(/\.[^.]+$/, '');
      setForm((current) => ({ ...current, title: stem.slice(0, TITLE_MAX) }));
    }
  }, [form.title]);

  const handleResetEverything = useCallback(() => {
    setFile(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setUploadedVideoId(null);
    resetProgress();
  }, [resetProgress]);

  const commitTag = useCallback(() => {
    const candidate = normaliseTag(form.tagInput);
    if (!candidate) {
      if (form.tagInput.trim().length > 0) {
        toast.error('// INVALID TAG // a-z 0-9 _ - only');
      }
      return;
    }
    if (form.tags.includes(candidate)) {
      setForm((current) => ({ ...current, tagInput: '' }));
      return;
    }
    if (form.tags.length >= TAGS_MAX_COUNT) {
      toast.error(`// MAX ${TAGS_MAX_COUNT} TAGS REACHED`);
      return;
    }
    setForm((current) => ({
      ...current,
      tagInput: '',
      tags: [...current.tags, candidate],
    }));
  }, [form.tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((existing) => existing !== tag),
    }));
  }, []);

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTag();
    } else if (
      event.key === 'Backspace' &&
      form.tagInput.length === 0 &&
      form.tags.length > 0
    ) {
      event.preventDefault();
      removeTag(form.tags[form.tags.length - 1]!);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || isUploading || uploadedVideoId) return;

    const parsed = createVideoSchema.safeParse({
      title: form.title,
      description: form.description,
      tags: form.tags,
      visibility: form.visibility,
    });
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormErrors | undefined;
        if (field && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }

    const fields: CreateVideoInput = parsed.data;

    try {
      const result = await start(({ onUploadProgress }) =>
        uploadVideo(fields, file, { onUploadProgress })
      );
      setUploadedVideoId(result.videoId);
      toast.success('// SIGNAL ACCEPTED // QUEUED FOR ENCODE');
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      const message =
        axiosErr.response?.data?.message ?? axiosErr.message ?? 'Upload failed';
      toast.error(`// UPLOAD FAILED // ${message}`);
    }
  };

  const titleCount = `${form.title.length}/${TITLE_MAX}`;
  const descriptionCount = `${form.description.length}/${DESCRIPTION_MAX}`;
  const submitDisabled =
    !file || isUploading || uploadedVideoId !== null || form.title.trim().length < TITLE_MIN;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">// FRAGMENT</span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // UPLOAD // INJECT NEW SIGNAL
        </h1>
      </header>

      <BrutalCard accent="orange" className="mb-6">
        <p className="font-mono text-xs uppercase opacity-60">// CONSTRAINTS //</p>
        <ul className="mt-2 grid grid-cols-1 gap-1 font-mono text-sm uppercase sm:grid-cols-2">
          <li className="flex justify-between gap-3">
            <span className="opacity-70">{'>>'} MAX SIZE</span>
            <span className="tabular-nums">{maxSizeMb} MB</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="opacity-70">{'>>'} MAX DURATION</span>
            <span className="tabular-nums">
              {Math.round(maxDurationSec / 60)} MIN
            </span>
          </li>
          <li className="sm:col-span-2 opacity-70">
            {'>>'} KEEP IT TIGHT // server is on a strict diet
          </li>
        </ul>
      </BrutalCard>

      {!file && (
        <BrutalCard accent="acid">
          <BrutalDivider label="STAGE 1 // PICK A FILE" />
          <DropZone
            onFile={handleFileAccepted}
            maxSizeMb={maxSizeMb}
            maxDurationSec={maxDurationSec}
          />
        </BrutalCard>
      )}

      {file && !uploadedVideoId && (
        <BrutalCard accent="electric">
          <BrutalDivider label="STAGE 2 // METADATA" />

          <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={isUploading || undefined}
            className="flex flex-col gap-4 font-mono"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-bone p-2 text-xs uppercase dark:bg-ink">
              <span className="truncate">
                // FILE: {file.name}
              </span>
              <button
                type="button"
                onClick={handleResetEverything}
                disabled={isUploading}
                className="border-2 border-ink px-2 py-0.5 text-xs uppercase hover:bg-orange disabled:opacity-50"
              >
                [ CHANGE FILE ]
              </button>
            </div>

            <div>
              <BrutalInput
                label="TITLE"
                type="text"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                error={errors.title}
                hint={`${TITLE_MIN}-${TITLE_MAX} chars · ${titleCount}`}
                maxLength={TITLE_MAX}
                required
              />
            </div>

            <div className="flex flex-col gap-1 font-mono">
              <label
                htmlFor="upload-description"
                className="text-xs uppercase tracking-tight text-ink dark:text-bone"
              >
                // DESCRIPTION
              </label>
              <textarea
                id="upload-description"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={4}
                className={cn(
                  'min-h-[120px] border-2 bg-bone p-3 text-sm text-ink outline-none placeholder:text-ink/40 dark:bg-ink dark:text-bone dark:placeholder:text-bone/40',
                  errors.description ? 'border-orange' : 'border-ink'
                )}
                placeholder="// what is this signal?"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs opacity-60">
                  // optional · markdown not supported
                </span>
                <span className="text-xs tabular-nums opacity-60">{descriptionCount}</span>
              </div>
              {errors.description && (
                <p role="alert" className="text-xs uppercase text-orange">
                  ! {errors.description}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 font-mono">
              <label
                htmlFor="upload-tag-input"
                className="text-xs uppercase tracking-tight"
              >
                // TAGS · {form.tags.length}/{TAGS_MAX_COUNT}
              </label>

              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 border-2 bg-bone p-2 dark:bg-ink',
                  errors.tags ? 'border-orange' : 'border-ink'
                )}
              >
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 border-2 border-ink bg-acid px-2 py-0.5 text-xs uppercase tabular-nums text-ink"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="ml-1 border border-ink px-1 leading-none hover:bg-ink hover:text-acid"
                    >
                      x
                    </button>
                  </span>
                ))}

                <input
                  id="upload-tag-input"
                  type="text"
                  value={form.tagInput}
                  onChange={(event) => updateField('tagInput', event.target.value.toLowerCase())}
                  onKeyDown={handleTagKeyDown}
                  onBlur={commitTag}
                  disabled={form.tags.length >= TAGS_MAX_COUNT}
                  placeholder={
                    form.tags.length === 0
                      ? '// type a tag, press enter'
                      : form.tags.length >= TAGS_MAX_COUNT
                        ? '// max reached'
                        : '// add another'
                  }
                  className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-xs uppercase outline-none placeholder:text-ink/40 dark:placeholder:text-bone/40"
                />
              </div>

              <p className="text-xs opacity-60">
                // a-z 0-9 _ - · max {TAGS_MAX_COUNT} · enter or comma to commit
              </p>
              {errors.tags && (
                <p role="alert" className="text-xs uppercase text-orange">
                  ! {errors.tags}
                </p>
              )}
            </div>

            <fieldset className="flex flex-col gap-2 font-mono">
              <legend className="text-xs uppercase tracking-tight">// VISIBILITY</legend>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {VIDEO_VISIBILITIES.map((option) => {
                  const active = form.visibility === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => updateField('visibility', option)}
                      className={cn(
                        'border-2 border-ink px-3 py-1 text-xs uppercase tracking-tight transition-none',
                        active
                          ? 'bg-acid text-ink shadow-[var(--shadow-brutal-sm)]'
                          : 'bg-transparent text-ink hover:bg-ink hover:text-bone dark:text-bone'
                      )}
                    >
                      [ {option.toUpperCase()} ]
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {(isUploading || progress > 0) && (
              <ProgressBar value={progress} label="UPLOADING" />
            )}

            <div className="mt-2 flex items-center justify-end gap-3">
              <BrutalButton type="submit" disabled={submitDisabled}>
                {isUploading ? `UPLOADING ${progress}%` : 'INITIATE TRANSCODE'}
              </BrutalButton>
            </div>
          </form>
        </BrutalCard>
      )}

      {uploadedVideoId && (
        <BrutalCard accent="phosphor">
          <BrutalDivider label="STAGE 3 // ENCODING PIPELINE" />
          <ProcessingStatus
            videoId={uploadedVideoId}
            onRetry={handleResetEverything}
          />
        </BrutalCard>
      )}
    </section>
  );
};

export default UploadPage;
