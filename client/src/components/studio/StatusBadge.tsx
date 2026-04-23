import type { VideoStatus } from '@shared/constants/enums.js';

import { BrutalBadge } from '../brutal/BrutalBadge.js';

interface StatusBadgeProps {
  status: VideoStatus;
  className?: string;
}

const STATUS_TONE: Record<VideoStatus, 'ink' | 'electric' | 'acid' | 'orange'> = {
  pending: 'ink',
  processing: 'electric',
  ready: 'acid',
  failed: 'orange',
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => (
  <BrutalBadge tone={STATUS_TONE[status]} className={className}>
    {status.toUpperCase()}
  </BrutalBadge>
);

export default StatusBadge;
