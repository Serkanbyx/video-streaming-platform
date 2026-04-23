import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';

import type { Comment } from '@shared/types/comment.js';

import * as commentService from '../../services/comment.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';
import { cn } from '../../utils/classNames.js';

const BODY_MAX = 1000;

interface CommentFormProps {
  videoId: string;
  parentId?: string;
  initialBody?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmitted: (comment: Comment) => void;
}

export const CommentForm = ({
  videoId,
  parentId,
  initialBody = '',
  submitLabel = 'POST',
  onCancel,
  onSubmitted,
}: CommentFormProps) => {
  const [body, setBody] = useState<string>(initialBody);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const remaining = BODY_MAX - body.length;
  const isOverLimit = remaining < 0;
  const trimmed = body.trim();
  const isEmpty = trimmed.length === 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isEmpty || isOverLimit || submitting) return;

    setSubmitting(true);
    try {
      const created = await commentService.createComment({
        videoId,
        body: trimmed,
        ...(parentId ? { parent: parentId } : {}),
      });
      setBody('');
      onSubmitted(created);
    } catch (error) {
      const message =
        (error as ExtendedAxiosError).response?.data?.message ??
        'Could not post comment';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border-2 border-ink bg-bone p-3 shadow-[var(--shadow-brutal-sm)] dark:bg-ink"
    >
      <label
        htmlFor={`comment-body-${parentId ?? 'root'}`}
        className="font-mono text-xs uppercase tracking-tight opacity-70"
      >
        // {parentId ? 'REPLY' : 'COMMENT'}
      </label>
      <textarea
        id={`comment-body-${parentId ?? 'root'}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={parentId ? 'reply with signal...' : 'broadcast a thought...'}
        rows={parentId ? 2 : 3}
        maxLength={BODY_MAX + 100}
        className="resize-y border-2 border-ink bg-bone px-3 py-2 font-mono text-sm text-ink outline-none focus:shadow-[var(--shadow-brutal-sm)] dark:bg-ink dark:text-bone"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs uppercase">
        <span
          className={cn(
            'tabular-nums',
            isOverLimit ? 'text-orange' : 'opacity-70'
          )}
        >
          {body.length} / {BODY_MAX}
        </span>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="border-2 border-ink bg-transparent px-2 py-1 text-xs uppercase tracking-tight text-ink hover:bg-ink hover:text-bone dark:text-bone"
            >
              [ CANCEL ]
            </button>
          )}
          <button
            type="submit"
            disabled={isEmpty || isOverLimit || submitting}
            className={cn(
              'border-2 border-ink px-3 py-1 text-xs uppercase tracking-tight transition-none',
              isEmpty || isOverLimit || submitting
                ? 'cursor-not-allowed bg-transparent text-ink/40 dark:text-bone/40'
                : 'bg-acid text-ink shadow-[var(--shadow-brutal-sm)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
            )}
          >
            [ {submitting ? '...' : submitLabel} ]
          </button>
        </div>
      </div>
    </form>
  );
};

export default CommentForm;
