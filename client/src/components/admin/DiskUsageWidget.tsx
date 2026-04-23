import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import type { CleanupReport, DiskAlertLevel, DiskUsageReport } from '@shared/types/admin.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { getDiskUsage, runCleanup } from '../../services/admin.service.js';
import { formatBytes } from '../../utils/formatBytes.js';
import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalCard } from '../brutal/BrutalCard.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';
import { CleanupModal } from './CleanupModal.js';

const REFRESH_INTERVAL_MS = 60_000;
const BAR_SEGMENTS = 20;

const ALERT_FILL: Record<DiskAlertLevel, string> = {
  ok: 'text-acid',
  warn: 'text-orange',
  critical: 'text-magenta',
};

const ALERT_LABEL: Record<DiskAlertLevel, string> = {
  ok: 'STABLE',
  warn: 'WARNING',
  critical: 'CRITICAL',
};

const buildAsciiBar = (percent: number): string => {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * BAR_SEGMENTS);
  return '█'.repeat(filled) + '░'.repeat(BAR_SEGMENTS - filled);
};

interface DiskUsageWidgetProps {
  className?: string;
}

export const DiskUsageWidget = ({ className = '' }: DiskUsageWidgetProps) => {
  const [report, setReport] = useState<DiskUsageReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getDiskUsage();
      setReport(data);
      setError(null);
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      setError(
        axiosErr.response?.data?.message ?? axiosErr.message ?? 'Failed to read disk usage'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const handleCleanup = async (dryRun: boolean): Promise<CleanupReport> => {
    try {
      const result = await runCleanup({ dryRun });
      toast.success(
        dryRun
          ? `// DRY RUN // ${formatBytes(result.bytesFreed)} WOULD BE FREED`
          : `// CLEANUP DONE // ${formatBytes(result.bytesFreed)} FREED`
      );
      if (!dryRun) await refresh();
      return result;
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      const message =
        axiosErr.response?.data?.message ?? axiosErr.message ?? 'Cleanup failed';
      toast.error(`// CLEANUP FAILED // ${message}`);
      throw err;
    }
  };

  return (
    <BrutalCard
      accent={
        report?.alertLevel === 'critical'
          ? 'magenta'
          : report?.alertLevel === 'warn'
            ? 'orange'
            : 'phosphor'
      }
      className={`flex flex-col gap-3 ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
          // STORAGE //
        </span>
        {report && (
          <span
            className={`font-mono text-[10px] uppercase tracking-widest ${ALERT_FILL[report.alertLevel]}`}
          >
            [ {ALERT_LABEL[report.alertLevel]} ]
          </span>
        )}
      </header>

      {loading && !report ? (
        <div className="py-6">
          <AsciiSpinner label="READING DISK" />
        </div>
      ) : error ? (
        <p className="font-mono text-xs text-orange">! {error}</p>
      ) : report ? (
        <>
          <p className="font-mono text-sm uppercase">
            USED <span className="tabular-nums">{formatBytes(report.usedBytes)}</span>
            {' / '}
            <span className="tabular-nums">{formatBytes(report.totalBytes)}</span>
            {'  -->  '}
            <span className="tabular-nums">{report.usedPercent.toFixed(1)}%</span>
          </p>

          <pre
            aria-hidden="true"
            className={`select-none font-mono text-base leading-none tracking-tight ${ALERT_FILL[report.alertLevel]}`}
          >
            {buildAsciiBar(report.usedPercent)}
          </pre>

          <p className="font-mono text-[11px] uppercase opacity-70">
            {'>>'} <span className="tabular-nums">{report.videoCount}</span> VIDEOS
            {'  // '}
            <span className="tabular-nums">{report.rawCount}</span> RAW
            {'  // '}
            <span className="tabular-nums">{report.orphanFolderCount}</span> ORPHAN
          </p>

          {report.alertLevel === 'critical' && (
            <div
              role="alert"
              className="border-2 border-magenta bg-magenta/10 p-2 font-mono text-[11px] uppercase text-magenta"
            >
              ! disk above 80% — consider running cleanup or migrating to b2
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="font-mono text-[10px] uppercase opacity-60">
              QUOTA · {report.quotaMb} MB
            </span>
            <BrutalButton size="sm" variant="outline" onClick={() => setCleanupOpen(true)}>
              RUN CLEANUP
            </BrutalButton>
          </div>
        </>
      ) : null}

      <CleanupModal
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        onRun={handleCleanup}
      />
    </BrutalCard>
  );
};

export default DiskUsageWidget;
