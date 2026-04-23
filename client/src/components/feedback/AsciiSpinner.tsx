import { useEffect, useState } from 'react';

const FRAMES = ['[|]', '[/]', '[-]', '[\\]'] as const satisfies readonly string[];
const FRAME_INTERVAL_MS = 100;

interface AsciiSpinnerProps {
  label?: string;
  className?: string;
}

export const AsciiSpinner = ({ label, className = '' }: AsciiSpinnerProps) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((value) => (value + 1) % FRAMES.length);
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
      className={`inline-flex items-center gap-2 font-mono text-acid ${className}`}
    >
      <span aria-hidden="true">{FRAMES[frame]}</span>
      {label && <span className="uppercase text-xs text-ink dark:text-bone">{label}</span>}
    </span>
  );
};

export default AsciiSpinner;
