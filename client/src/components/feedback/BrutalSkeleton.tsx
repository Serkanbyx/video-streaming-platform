import type { CSSProperties } from 'react';

type SkeletonShape = 'block' | 'line' | 'thumbnail' | 'avatar';

interface BrutalSkeletonProps {
  shape?: SkeletonShape;
  width?: string | number;
  height?: string | number;
  className?: string;
  ariaLabel?: string;
}

const SHAPE_CLASSES: Record<SkeletonShape, string> = {
  block: 'h-24 w-full',
  line: 'h-3 w-full',
  thumbnail: 'aspect-video w-full',
  avatar: 'h-10 w-10 rounded-none',
};

const toCssSize = (value: string | number | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

/**
 * Single placeholder block. Brutal palette: hard borders, alternating
 * cream / ink fills depending on the surrounding theme — handled by the
 * parent `BrutalSkeletonGrid`.
 */
export const BrutalSkeleton = ({
  shape = 'block',
  width,
  height,
  className = '',
  ariaLabel = 'Loading content',
}: BrutalSkeletonProps) => {
  const style: CSSProperties = {};
  const w = toCssSize(width);
  const h = toCssSize(height);
  if (w) style.width = w;
  if (h) style.height = h;

  return (
    <span
      role="presentation"
      aria-label={ariaLabel}
      style={style}
      className={`fragment-skeleton inline-block border-2 border-ink bg-ink dark:bg-bone ${SHAPE_CLASSES[shape]} ${className}`}
    />
  );
};

interface BrutalSkeletonGridProps {
  count?: number;
  columns?: number;
  className?: string;
}

/**
 * Grid of alternating black/cream skeleton tiles. Each tile flips colour by
 * index so the pulsing reads as a marching binary strip rather than a soft
 * fade.
 */
export const BrutalSkeletonGrid = ({
  count = 8,
  columns = 4,
  className = '',
}: BrutalSkeletonGridProps) => {
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={gridStyle}
      className={`grid gap-3 ${className}`}
    >
      {Array.from({ length: count }, (_, index) => {
        const inverted = index % 2 === 1;
        const colour = inverted
          ? 'bg-bone dark:bg-ink border-ink'
          : 'bg-ink dark:bg-bone border-ink';
        return (
          <div
            key={index}
            className={`fragment-skeleton aspect-video border-2 ${colour}`}
          />
        );
      })}
    </div>
  );
};

export default BrutalSkeleton;
