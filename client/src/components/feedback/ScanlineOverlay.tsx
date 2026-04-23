import { usePreferences } from '../../context/PreferencesContext.js';

/**
 * The static scanline pattern lives in `index.css` (`html[data-scanlines]::after`)
 * so it ships with zero runtime cost. This component layers two extra effects
 * on top — a soft vignette and a slow vertical sweep — both gated by the
 * user's scanline + motion preferences.
 *
 * Pointer-events are disabled and the overlay sits behind the toaster
 * (z-9990) so it never blocks interaction or accessible content.
 */
export const ScanlineOverlay = () => {
  const { preferences } = usePreferences();
  if (!preferences.scanlines) return null;

  const motionEnabled = preferences.animations === 'full';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-9990 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
        }}
      />
      {motionEnabled && (
        <div
          className="fragment-scan-sweep absolute inset-x-0 top-0 h-24"
          style={{
            background:
              'linear-gradient(to bottom, transparent, rgba(185,255,102,0.06), transparent)',
            mixBlendMode: 'screen',
          }}
        />
      )}
    </div>
  );
};

export default ScanlineOverlay;
