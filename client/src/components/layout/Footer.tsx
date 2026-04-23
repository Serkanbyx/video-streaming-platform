import { usePreferences } from '../../context/PreferencesContext.js';

const APP_VERSION = '1.0.0';
const REPO_URL = 'https://github.com/fragment/fragment';
const LICENSE_URL = 'https://opensource.org/licenses/MIT';

/**
 * Brutalist footer mounted by `MainLayout`. Three-column zine-style layout on
 * desktop collapsing to a stacked layout on small screens. Theme + scanline
 * toggles dispatch through `PreferencesContext` so guests get localStorage
 * persistence and signed-in users get server-side persistence.
 */
export const Footer = () => {
  const { preferences, updatePreference } = usePreferences();
  const commitSha = (import.meta.env.VITE_COMMIT_SHA ?? 'dev').slice(0, 7);

  const isDark =
    preferences.theme === 'dark' ||
    (preferences.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const handleThemeToggle = (nextDark: boolean): void => {
    void updatePreference('theme', nextDark ? 'dark' : 'light');
  };

  const handleScanlinesToggle = (next: boolean): void => {
    void updatePreference('scanlines', next);
  };

  return (
    <footer className="border-t-2 border-ink bg-bone text-ink dark:bg-ink dark:text-bone">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 font-mono text-sm md:grid-cols-3">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-magenta">
            // FRAGMENT
          </h2>
          <p className="text-base leading-snug">
            Raw video. Hard edges. No algorithm. A brutalist streaming statement.
          </p>
          <p className="mt-4 text-xs uppercase text-ink/60 dark:text-bone/60">
            BUILD <span className="tabular-nums">v{APP_VERSION}</span>
            {' // '}
            SHA <span className="tabular-nums">{commitSha}</span>
          </p>
        </section>

        <nav aria-label="Footer links">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-magenta">
            // LINKS
          </h2>
          <ul className="space-y-2 text-sm uppercase">
            <li>
              <FooterLink href="/about" external={false}>
                About
              </FooterLink>
            </li>
            <li>
              <FooterLink href={REPO_URL} external>
                <GithubMark />
                <span className="ml-1">GitHub Repo</span>
              </FooterLink>
            </li>
            <li>
              <FooterLink href={LICENSE_URL} external>
                License (MIT)
              </FooterLink>
            </li>
          </ul>
        </nav>

        <section aria-label="System preferences">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-magenta">
            // SYSTEM
          </h2>
          <div className="space-y-3">
            <SegmentedToggle
              label="THEME"
              value={isDark ? 'DARK' : 'LIGHT'}
              options={['LIGHT', 'DARK']}
              onChange={(option) => handleThemeToggle(option === 'DARK')}
            />
            <SegmentedToggle
              label="SCANLINES"
              value={preferences.scanlines ? 'ON' : 'OFF'}
              options={['ON', 'OFF']}
              onChange={(option) => handleScanlinesToggle(option === 'ON')}
            />
          </div>
        </section>
      </div>

      <div className="border-t border-ink bg-ink py-3 text-center font-mono text-xs uppercase tracking-wider text-bone">
        [BUILT WITH FFMPEG // HLS // REACT // TYPESCRIPT]
      </div>
    </footer>
  );
};

/**
 * Inlined GitHub mark — `lucide-react` dropped its branded `Github` icon over
 * trademark concerns, so we ship a hand-rolled brutalist version with a 2px
 * stroke matching the rest of the icon language in the UI.
 */
const GithubMark = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="square"
    strokeLinejoin="miter"
    aria-hidden="true"
    className="inline-block align-text-bottom"
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

interface FooterLinkProps {
  href: string;
  external: boolean;
  children: React.ReactNode;
}

const FooterLink = ({ href, external, children }: FooterLinkProps) => {
  const className =
    'inline-flex items-center text-ink hover:text-magenta dark:text-bone dark:hover:text-magenta';
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span aria-hidden="true" className="mr-2">
          &gt;
        </span>
        {children}
      </a>
    );
  }
  return (
    <a href={href} className={className}>
      <span aria-hidden="true" className="mr-2">
        &gt;
      </span>
      {children}
    </a>
  );
};

interface SegmentedToggleProps {
  label: string;
  value: string;
  options: readonly [string, string];
  onChange: (option: string) => void;
}

const SegmentedToggle = ({ label, value, options, onChange }: SegmentedToggleProps) => (
  <div className="flex flex-wrap items-center gap-3 text-xs uppercase">
    <span className="text-ink/70 dark:text-bone/70">// {label}</span>
    <div role="group" aria-label={label} className="inline-flex border-2 border-ink">
      {options.map((option, index) => {
        const isActive = option === value;
        const borderClass = index === 0 ? '' : 'border-l-2 border-ink';
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={`${borderClass} px-3 py-1.5 font-bold tracking-tight ${
              isActive
                ? 'bg-acid text-ink'
                : 'bg-bone text-ink hover:bg-ink hover:text-bone dark:bg-ink dark:text-bone dark:hover:bg-bone dark:hover:text-ink'
            }`}
          >
            [ {option} ]
          </button>
        );
      })}
    </div>
  </div>
);

export default Footer;
