import { useEffect, useState } from 'react';

import type { CleanupReport } from '@shared/types/admin.js';

import { formatBytes } from '../../utils/formatBytes.js';
import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalModal } from '../brutal/BrutalModal.js';
import { BrutalToggle } from '../brutal/BrutalToggle.js';

interface CleanupModalProps {
  open: boolean;
  onClose: () => void;
  onRun: (dryRun: boolean) => Promise<CleanupReport>;
}

export const CleanupModal = ({ open, onClose, onRun }: CleanupModalProps) => {
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastReport, setLastReport] = useState<CleanupReport | null>(null);

  useEffect(() => {
    if (open) {
      setDryRun(true);
      setSubmitting(false);
      setLastReport(null);
    }
  }, [open]);

  const handleRun = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await onRun(dryRun);
      setLastReport(result);
    } catch {
      /* surfaced via toast in the parent handler */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BrutalModal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="DISK CLEANUP"
      size="md"
      footer={
        <>
          <BrutalButton
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            CLOSE
          </BrutalButton>
          <BrutalButton
            variant={dryRun ? 'solid' : 'danger'}
            size="sm"
            onClick={handleRun}
            disabled={submitting}
          >
            {submitting ? 'WORKING...' : dryRun ? 'PREVIEW' : 'RUN CLEANUP'}
          </BrutalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 font-mono text-sm">
        <p className="border-2 border-ink bg-ink/5 p-3 text-xs uppercase dark:bg-bone/5">
          {'>>'} sweeps failed videos older than 7 days, orphan folders, missing
          HLS rows and stale raw uploads.
        </p>

        <BrutalToggle
          checked={dryRun}
          onChange={setDryRun}
          label="DRY RUN"
          description="preview the impact without deleting anything"
          disabled={submitting}
        />

        {lastReport && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-2 border-ink p-3 text-xs">
            <dt className="opacity-60">// MODE</dt>
            <dd>{lastReport.dryRun ? 'DRY RUN' : 'EXECUTED'}</dd>
            <dt className="opacity-60">// FAILED VIDEOS</dt>
            <dd className="tabular-nums">{lastReport.failedVideosDeleted}</dd>
            <dt className="opacity-60">// ORPHAN FOLDERS</dt>
            <dd className="tabular-nums">{lastReport.orphanFoldersDeleted}</dd>
            <dt className="opacity-60">// MISSING HLS</dt>
            <dd className="tabular-nums">{lastReport.missingHlsMarkedFailed}</dd>
            <dt className="opacity-60">// STALE RAW</dt>
            <dd className="tabular-nums">{lastReport.staleRawDeleted}</dd>
            <dt className="opacity-60">// BYTES FREED</dt>
            <dd className="tabular-nums">{formatBytes(lastReport.bytesFreed)}</dd>
          </dl>
        )}
      </div>
    </BrutalModal>
  );
};

export default CleanupModal;
