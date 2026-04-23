import { useEffect } from 'react';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION_MS = 3000;

/**
 * Wrapper around `react-hot-toast`'s `<Toaster />` that enforces a hard
 * stack limit. The library doesn't ship a `maxToasts` option, so we read
 * the live store and dismiss the oldest visible toast whenever the queue
 * grows past the cap. This keeps the UI honest with the brutalist
 * "no clutter" rule.
 */
export const BrutalToaster = () => {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((entry) => entry.visible)
      .slice(MAX_VISIBLE_TOASTS)
      .forEach((entry) => toast.dismiss(entry.id));
  }, [toasts]);

  return (
    <Toaster
      position="top-right"
      gutter={12}
      toastOptions={{
        duration: DEFAULT_DURATION_MS,
        className:
          'border-2 border-ink bg-bone text-ink font-mono uppercase text-sm shadow-(--shadow-brutal-sm)',
        success: {
          iconTheme: { primary: '#b9ff66', secondary: '#0a0a0a' },
        },
        error: {
          iconTheme: { primary: '#ff5b1f', secondary: '#0a0a0a' },
          className:
            'border-2 border-orange bg-bone text-ink font-mono uppercase text-sm shadow-(--shadow-brutal-sm)',
        },
      }}
    />
  );
};

export default BrutalToaster;
