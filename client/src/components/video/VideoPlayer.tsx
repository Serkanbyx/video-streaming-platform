import { useRef } from 'react';
import ReactPlayer from 'react-player';

import { usePreferences } from '../../context/PreferencesContext.js';
import { useGuestFingerprint } from '../../hooks/useGuestFingerprint.js';
import * as videoService from '../../services/video.service.js';
import { resolveAssetUrl } from '../../utils/constants.js';

interface VideoPlayerProps {
  videoId: string;
  hlsPath: string | null;
  onViewRecorded?: (views: number) => void;
}

const SCRUB_BARS = Array.from({ length: 64 }, (_, index) => {
  // Deterministic pseudo-random heights so the decorative bar stays stable
  // across renders without pulling in a Math.random() side-effect.
  const seed = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return Math.abs(seed - Math.floor(seed));
});

export const VideoPlayer = ({ videoId, hlsPath, onViewRecorded }: VideoPlayerProps) => {
  const { preferences } = usePreferences();
  const fingerprint = useGuestFingerprint();
  const recordedRef = useRef<boolean>(false);

  const streamUrl = resolveAssetUrl(hlsPath);

  const handleCanPlay = (): void => {
    if (recordedRef.current || !streamUrl) return;
    recordedRef.current = true;
    videoService
      .recordView(videoId, fingerprint ? { fingerprint } : {})
      .then((result) => {
        if (result.counted) onViewRecorded?.(result.views);
      })
      .catch(() => {
        // Swallow: a failed view ping should never break playback UX.
      });
  };

  if (!streamUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center border-2 border-ink bg-ink font-mono text-xs uppercase tracking-widest text-bone/60">
        // SIGNAL UNAVAILABLE
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-2 border-ink bg-ink shadow-[var(--shadow-brutal)]">
        <ReactPlayer
          src={streamUrl}
          controls
          playsInline
          width="100%"
          height="auto"
          playing={preferences.content.autoplay}
          volume={preferences.content.defaultVolume}
          onCanPlay={handleCanPlay}
          style={{ display: 'block', width: '100%', aspectRatio: '16 / 9' }}
        />
      </div>

      <div
        aria-hidden="true"
        className="flex h-6 items-end gap-[2px] border-2 border-ink bg-bone px-2 dark:bg-ink"
      >
        {SCRUB_BARS.map((value, index) => (
          <span
            key={index}
            className="block w-[3px] flex-shrink-0 bg-acid"
            style={{ height: `${Math.max(15, value * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoPlayer;
