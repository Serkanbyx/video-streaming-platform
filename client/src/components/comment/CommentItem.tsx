import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { Comment } from '@shared/types/comment.js';

import { useAuth } from '../../context/AuthContext.js';
import * as commentService from '../../services/comment.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';
import { cn } from '../../utils/classNames.js';
import { resolveAssetUrl } from '../../utils/constants.js';
import { formatRelativeDate } from '../../utils/formatDate.js';

import { CommentForm } from './CommentForm.js';

interface CommentItemProps {
  comment: Comment;
  videoId: string;
  onUpdated: (comment: Comment) => void;
  onDeleted: (commentId: string) => void;
  onReplyAdded?: (reply: Comment) => void;
}

export const CommentItem = ({
  comment,
  videoId,
  onUpdated,
  onDeleted,
  onReplyAdded,
}: CommentItemProps) => {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const [replying, setReplying] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const isOwner = Boolean(user && comment.author && user._id === comment.author._id);
  const canEdit = isOwner && !comment.isDeleted;
  const canDelete = (isOwner || isAdmin) && !comment.isDeleted;

  const avatarSrc = resolveAssetUrl(comment.author?.avatarUrl ?? null);
  const channelHref = comment.author ? `/c/${comment.author.username}` : '#';

  const handleDelete = async (): Promise<void> => {
    if (deleting) return;
    if (!window.confirm('Delete this comment?')) return;
    setDeleting(true);
    try {
      const result = await commentService.deleteComment(comment._id);
      onDeleted(result._id);
    } catch (error) {
      const message =
        (error as ExtendedAxiosError).response?.data?.message ??
        'Could not delete comment';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article
      className={cn(
        'flex gap-3 border-2 border-ink bg-bone p-3 dark:bg-ink',
        comment.isDeleted && 'opacity-60'
      )}
    >
      <Link
        to={channelHref}
        aria-label={
          comment.author ? `Visit ${comment.author.username}` : 'Unknown user'
        }
        className="block size-10 shrink-0 overflow-hidden border-2 border-ink bg-bone dark:bg-ink"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase opacity-60">
            ::
          </span>
        )}
      </Link>

      <div className="flex w-full min-w-0 flex-col gap-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0 font-mono text-xs uppercase tracking-tight">
          <Link
            to={channelHref}
            className="font-semibold hover:text-magenta hover:underline"
          >
            // {comment.author?.username ?? 'unknown'}
          </Link>
          <span className="opacity-60">{formatRelativeDate(comment.createdAt)}</span>
          {comment.isEdited && !comment.isDeleted && (
            <span className="opacity-60">[ EDITED ]</span>
          )}
        </header>

        <p className="whitespace-pre-wrap break-words font-mono text-sm">
          {comment.isDeleted ? '// [ comment removed ]' : comment.body}
        </p>

        {!comment.isDeleted && (
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-tight">
            {isAuthenticated && onReplyAdded && (
              <button
                type="button"
                onClick={() => setReplying((value) => !value)}
                className="border-2 border-ink bg-transparent px-2 py-0.5 text-ink hover:bg-ink hover:text-bone dark:text-bone"
              >
                [ {replying ? 'CLOSE' : 'REPLY'} ]
              </button>
            )}
            {canEdit && (
              <InlineEditButton
                comment={comment}
                onUpdated={onUpdated}
              />
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="border-2 border-orange bg-transparent px-2 py-0.5 text-orange hover:bg-orange hover:text-ink disabled:opacity-50"
              >
                [ {deleting ? '...' : 'DELETE'} ]
              </button>
            )}
            {comment.replyCount > 0 && (
              <span className="opacity-60">// {comment.replyCount} REPLIES</span>
            )}
          </div>
        )}

        {replying && onReplyAdded && (
          <div className="mt-2">
            <CommentForm
              videoId={videoId}
              parentId={comment._id}
              submitLabel="REPLY"
              onCancel={() => setReplying(false)}
              onSubmitted={(reply) => {
                onReplyAdded(reply);
                setReplying(false);
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
};

interface InlineEditButtonProps {
  comment: Comment;
  onUpdated: (comment: Comment) => void;
}

/**
 * Tiny inline-edit affordance that swaps the comment body for a textarea.
 * Kept local to CommentItem because edit-flow is the only consumer and it
 * lets us reuse the comment row's existing layout.
 */
const InlineEditButton = ({ comment, onUpdated }: InlineEditButtonProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [body, setBody] = useState<string>(comment.body);
  const [saving, setSaving] = useState<boolean>(false);

  const trimmed = body.trim();

  const handleSave = async (): Promise<void> => {
    if (saving || !trimmed || trimmed === comment.body) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await commentService.editComment(comment._id, { body: trimmed });
      onUpdated(updated);
      setOpen(false);
    } catch (error) {
      const message =
        (error as ExtendedAxiosError).response?.data?.message ??
        'Could not save comment';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-2 border-ink bg-transparent px-2 py-0.5 text-ink hover:bg-ink hover:text-bone dark:text-bone"
      >
        [ EDIT ]
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={1100}
        className="resize-y border-2 border-ink bg-bone px-3 py-2 font-mono text-sm text-ink outline-none focus:shadow-[var(--shadow-brutal-sm)] dark:bg-ink dark:text-bone"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !trimmed}
          className="border-2 border-ink bg-acid px-2 py-0.5 text-ink shadow-[var(--shadow-brutal-sm)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
        >
          [ {saving ? '...' : 'SAVE'} ]
        </button>
        <button
          type="button"
          onClick={() => {
            setBody(comment.body);
            setOpen(false);
          }}
          className="border-2 border-ink bg-transparent px-2 py-0.5 text-ink hover:bg-ink hover:text-bone dark:text-bone"
        >
          [ CANCEL ]
        </button>
      </div>
    </div>
  );
};

export default CommentItem;
