/**
 * Minimal scaffold so layouts mount cleanly. The full three-column footer
 * (manifesto, links, theme/scanline toggles) lands in STEP 22.
 */
export const Footer = () => (
  <footer className="border-t-2 border-ink bg-bone text-ink dark:bg-ink dark:text-bone">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 font-mono text-xs uppercase">
      <span>// FRAGMENT</span>
      <span className="opacity-70">[ BUILT WITH FFMPEG // HLS // REACT // TYPESCRIPT ]</span>
    </div>
  </footer>
);

export default Footer;
