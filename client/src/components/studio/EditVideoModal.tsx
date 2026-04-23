import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import toast from 'react-hot-toast';

import {
  updateVideoSchema,
  type UpdateVideoInput,
} from '@shared/schemas/video.schema.js';
import {
  VIDEO_VISIBILITIES,
  type VideoVisibility,
} from '@shared/constants/enums.js';
import type { Video } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { updateVideo } from '../../services/video.service.js';
import { cn } from '../../utils/classNames.js';
import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalInput } from '../brutal/BrutalInput.js';
import { BrutalModal } from '../brutal/BrutalModal.js';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const TAG_MAX = 24;
const TAGS_MAX_COUNT = 8;

interface EditVideoModalProps {
  open: boolean;
  video: Video | null;
  onClose: () => void;
  onSaved: (video: Video) => void;
}

interface FormState {
  title: string;
  description: string;
  tagInput: string;
  tags: string[];
  visibility: VideoVisibility;
}

type FormErrors = Partial<Record<'title' | 'description' | 'tags' | 'visibility', string>>;

const buildInitialForm = (video: Video | null): FormState => ({
  title: video?.title ?? '',
  description: video?.description ?? '',
  tagInput: '',
  tags: video?.tags ? [...video.tags] : [],
  visibility: video?.visibility ?? 'public',
});

const normaliseTag = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (trimmed.length > TAG_MAX) return null;
  if (!/^[a-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
};

/**
 * Detects whether the form payload differs from the current video so we can
 * skip the network round-trip when the user just opens and closes the modal.
 */
const computePatch = (
  video: Video,
  form: FormState
): UpdateVideoInput | null => {
  const patch: Partial<UpdateVideoInput> = {};
  const trimmedTitle = form.title.trim();
  const trimmedDescription = form.description.trim();

  if (trimmedTitle !== video.title) patch.title = trimmedTitle;
  if (trimmedDescription !== video.description) patch.description = trimmedDescription;
  if (form.visibility !== video.visibility) patch.visibility = form.visibility;

  const currentTags = [...video.tags].sort();
  const nextTags = [...form.tags].sort();
  const tagsChanged =
    currentTags.length !== nextTags.length ||
    currentTags.some((tag, index) => tag !== nextTags[index]);
  if (tagsChanged) patch.tags = form.tags;

  if (Object.keys(patch).length === 0) return null;
  return patch as UpdateVideoInput;
};

export const EditVideoModal = ({
  open,
  video,
  onClose,
  onSaved,
}: EditVideoModalProps) => {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(video));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reset form whenever the modal opens for a different video so users don't
  // see stale state from a previous edit session.
  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(video));
      setErrors({});
      setSubmitting(false);
    }
  }, [open, video]);

  const titleCount = `${form.title.length}/${TITLE_MAX}`;
  const descriptionCount = `${form.description.length}/${DESCRIPTION_MAX}`;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) {
      setErrors((current) => ({ ...current, [key as keyof FormErrors]: undefined }));
    }
  };

  const commitTag = () => {
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
  };

  const removeTag = (tag: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.filter((existing) => existing !== tag),
    }));
  };

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
    if (!video || submitting) return;

    const patch = computePatch(video, form);
    if (!patch) {
      toast('// NO CHANGES TO SAVE');
      onClose();
      return;
    }

    const parsed = updateVideoSchema.safeParse(patch);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormErrors | undefined;
        if (field && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateVideo(video.videoId, parsed.data);
      toast.success('// SIGNAL UPDATED');
      onSaved(updated);
      onClose();
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      const message =
        axiosErr.response?.data?.message ?? axiosErr.message ?? 'Update failed';
      toast.error(`// UPDATE FAILED // ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled =
    submitting || form.title.trim().length < TITLE_MIN || !video;

  const footer = useMemo(
    () => (
      <>
        <BrutalButton
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          CANCEL
        </BrutalButton>
        <BrutalButton
          type="submit"
          size="sm"
          form="edit-video-form"
          disabled={submitDisabled}
        >
          {submitting ? 'SAVING...' : 'SAVE'}
        </BrutalButton>
      </>
    ),
    [onClose, submitting, submitDisabled]
  );

  return (
    <BrutalModal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="EDIT VIDEO"
      size="lg"
      footer={footer}
    >
      <form
        id="edit-video-form"
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
        className="flex flex-col gap-4"
        aria-busy={submitting || undefined}
      >
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

        <div className="flex flex-col gap-1 font-mono">
          <label
            htmlFor="edit-video-description"
            className="text-xs uppercase tracking-tight text-ink dark:text-bone"
          >
            // DESCRIPTION
          </label>
          <textarea
            id="edit-video-description"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            className={cn(
              'min-h-30 border-2 bg-bone p-3 text-sm text-ink outline-none placeholder:text-ink/40 dark:bg-ink dark:text-bone dark:placeholder:text-bone/40',
              errors.description ? 'border-orange' : 'border-ink'
            )}
            placeholder="// what is this signal?"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs opacity-60">
              // optional · markdown not supported
            </span>
            <span className="text-xs tabular-nums opacity-60">
              {descriptionCount}
            </span>
          </div>
          {errors.description && (
            <p role="alert" className="text-xs uppercase text-orange">
              ! {errors.description}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 font-mono">
          <label
            htmlFor="edit-video-tag-input"
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
              id="edit-video-tag-input"
              type="text"
              value={form.tagInput}
              onChange={(event) =>
                updateField('tagInput', event.target.value.toLowerCase())
              }
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
              className="min-w-30 flex-1 bg-transparent px-1 py-0.5 text-xs uppercase outline-none placeholder:text-ink/40 dark:placeholder:text-bone/40"
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
                      ? 'bg-acid text-ink shadow-(--shadow-brutal-sm)'
                      : 'bg-transparent text-ink hover:bg-ink hover:text-bone dark:text-bone'
                  )}
                >
                  [ {option.toUpperCase()} ]
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>
    </BrutalModal>
  );
};

export default EditVideoModal;
