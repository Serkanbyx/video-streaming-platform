import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import type { Video } from '@shared/types/video.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { deleteVideo } from '../../services/video.service.js';
import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalModal } from '../brutal/BrutalModal.js';
import { BrutalToggle } from '../brutal/BrutalToggle.js';

interface DeleteVideoModalProps {
  open: boolean;
  video: Video | null;
  onClose: () => void;
  onDeleted: (videoId: string) => void;
}

export const DeleteVideoModal = ({
  open,
  video,
  onClose,
  onDeleted,
}: DeleteVideoModalProps) => {
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reset the explicit confirmation each time the modal opens so the user
  // always re-acknowledges the destructive action.
  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!video || submitting || !confirmed) return;
    setSubmitting(true);
    try {
      await deleteVideo(video.videoId);
      toast.success('// SIGNAL ERASED');
      onDeleted(video.videoId);
      onClose();
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      const message =
        axiosErr.response?.data?.message ?? axiosErr.message ?? 'Delete failed';
      toast.error(`// DELETE FAILED // ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

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
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={!confirmed || submitting || !video}
        >
          {submitting ? 'DELETING...' : 'DELETE FOREVER'}
        </BrutalButton>
      </>
    ),
    [onClose, submitting, confirmed, video, handleDelete]
  );

  return (
    <BrutalModal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="PERMANENT DELETION"
      size="md"
      footer={footer}
    >
      <div className="flex flex-col gap-4 font-mono text-sm">
        <div className="border-2 border-orange bg-orange/10 p-3 text-xs uppercase">
          {'>>'} this action cannot be undone. all comments, likes and views
          will be erased alongside the video file.
        </div>

        {video && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-2 border-ink p-3 text-xs">
            <dt className="opacity-60">// TITLE</dt>
            <dd className="truncate">{video.title}</dd>
            <dt className="opacity-60">// ID</dt>
            <dd className="tabular-nums">{video.videoId}</dd>
            <dt className="opacity-60">// VIEWS</dt>
            <dd className="tabular-nums">{video.views}</dd>
          </dl>
        )}

        <BrutalToggle
          checked={confirmed}
          onChange={setConfirmed}
          label="I UNDERSTAND THIS IS PERMANENT"
          description="check the box to enable the delete button"
          disabled={submitting}
        />
      </div>
    </BrutalModal>
  );
};

export default DeleteVideoModal;
