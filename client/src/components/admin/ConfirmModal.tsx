import { useEffect, useState, type ReactNode } from 'react';

import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalModal } from '../brutal/BrutalModal.js';
import { BrutalToggle } from '../brutal/BrutalToggle.js';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  acknowledgeLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Generic destructive-action confirmation. When `acknowledgeLabel` is supplied
 * the confirm button stays disabled until the user explicitly checks an
 * acknowledgement toggle — used for irreversible deletes.
 */
export const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'CANCEL',
  acknowledgeLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) => {
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  const requireAck = Boolean(acknowledgeLabel);
  const confirmDisabled = loading || (requireAck && !acknowledged);

  return (
    <BrutalModal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      size="md"
      footer={
        <>
          <BrutalButton
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </BrutalButton>
          <BrutalButton
            variant={destructive ? 'danger' : 'solid'}
            size="sm"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {loading ? 'WORKING...' : confirmLabel}
          </BrutalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 font-mono text-sm">
        <div
          className={
            destructive
              ? 'border-2 border-orange bg-orange/10 p-3 text-xs uppercase'
              : 'border-2 border-ink bg-ink/5 p-3 text-xs uppercase dark:bg-bone/5'
          }
        >
          {description}
        </div>

        {requireAck && (
          <BrutalToggle
            checked={acknowledged}
            onChange={setAcknowledged}
            label={acknowledgeLabel ?? ''}
            description="check the box to enable the action"
            disabled={loading}
          />
        )}
      </div>
    </BrutalModal>
  );
};

export default ConfirmModal;
