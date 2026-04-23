import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
  type NavLinkRenderProps,
} from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Brutalist top navigation. Frame-bearing component used by every page mounted
 * inside `MainLayout`. Composition (left → right):
 *
 * - Oversized monospace logo with optional RGB-split glitch on hover.
 * - Desktop-only nav links, role-gated (`SUBSCRIPTIONS`, `STUDIO`).
 * - Debounced search box: pushes `?q=...` to the home page on Enter, and
 *   keeps the URL in sync while the user is already on `/`.
 * - Creator-only `[ + UPLOAD ]` quick action.
 * - Authenticated user dropdown (profile / history / settings / admin / logout)
 *   or guest auth links.
 * - Mobile hamburger that opens a full-bleed brutalist overlay sheet.
 */
export const Navbar = () => {
  const { user, isAuthenticated, isCreator, isAdmin, logout } = useAuth();
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialQuery = useMemo(() => searchParams.get('q') ?? '', [searchParams]);
  const [searchValue, setSearchValue] = useState<string>(initialQuery);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const debouncedSearch = useDebounce(searchValue, SEARCH_DEBOUNCE_MS);

  // Reflect URL query → input when the user navigates externally (e.g. clicks
  // a recommended search). Avoid clobbering local edits while typing.
  useEffect(() => {
    const next = searchParams.get('q') ?? '';
    setSearchValue((current) => (current === next ? current : next));
  }, [searchParams]);

  // Live URL sync while already on the home page so back/forward stays useful.
  useEffect(() => {
    if (location.pathname !== '/') return;
    const current = searchParams.get('q') ?? '';
    if (debouncedSearch === current) return;
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    else params.delete('q');
    navigate({ pathname: '/', search: params.toString() }, { replace: true });
  }, [debouncedSearch, location.pathname, navigate, searchParams]);

  // Close any popovers when route changes (navigation closes the menu sheet).
  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Click-outside + Escape for the avatar dropdown.
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const handlePointer = (event: MouseEvent): void => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [userMenuOpen]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = searchValue.trim();
      const params = new URLSearchParams();
      if (trimmed) params.set('q', trimmed);
      navigate({ pathname: '/', search: params.toString() });
    },
    [navigate, searchValue]
  );

  const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      (event.target as HTMLInputElement).blur();
    }
  }, []);

  const handleLogout = useCallback(() => {
    setUserMenuOpen(false);
    setMenuOpen(false);
    logout();
    navigate('/');
  }, [logout, navigate]);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-bone text-ink dark:bg-ink dark:text-bone">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 font-mono uppercase"
      >
        <Link
          to="/"
          aria-label="FRAGMENT — home"
          className={`font-display font-bold tracking-tight text-[22px] md:text-[28px] leading-none ${
            reducedMotion ? '' : 'glitch'
          }`}
        >
          [FRAGMENT]
        </Link>

        <ul className="hidden items-center gap-5 text-sm md:flex">
          <li>
            <NavLink to="/" end className={navLinkClass}>
              // HOME
            </NavLink>
          </li>
          {isAuthenticated && (
            <li>
              <NavLink to="/me/subscriptions" className={navLinkClass}>
                // SUBSCRIPTIONS
              </NavLink>
            </li>
          )}
          {isCreator && (
            <li>
              <NavLink to="/studio" className={navLinkClass}>
                // STUDIO
              </NavLink>
            </li>
          )}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="flex items-stretch border-2 border-ink bg-bone dark:bg-ink focus-within:shadow-(--shadow-brutal-sm)"
          >
            <label htmlFor="navbar-search" className="sr-only">
              Search videos
            </label>
            <input
              id="navbar-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder=">> SEARCH"
              autoComplete="off"
              className="w-44 min-w-0 bg-transparent px-3 py-1.5 text-sm text-ink dark:text-bone placeholder:text-ink/40 dark:placeholder:text-bone/40 outline-none lg:w-56"
            />
            <button
              type="submit"
              aria-label="Run search"
              className="border-l-2 border-ink bg-ink px-2 text-acid hover:bg-acid hover:text-ink"
            >
              [&gt;]
            </button>
          </form>

          {isCreator && (
            <Link
              to="/upload"
              className="border-2 border-ink bg-acid px-3 py-1.5 text-sm font-bold text-ink shadow-(--shadow-brutal-sm) hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              [ + UPLOAD ]
            </Link>
          )}

          {isAuthenticated && user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 border-2 border-ink bg-bone px-2 py-1 text-xs hover:bg-ink hover:text-bone dark:bg-ink dark:text-bone dark:hover:bg-bone dark:hover:text-ink"
              >
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  displayName={user.displayName || user.username}
                />
                <span className="max-w-32 truncate">{user.username}</span>
                <span aria-hidden="true">v</span>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 mt-2 w-56 border-2 border-ink bg-bone text-ink shadow-(--shadow-brutal) dark:bg-ink dark:text-bone"
                >
                  <DropdownLink to="/me" onSelect={() => setUserMenuOpen(false)}>
                    // PROFILE
                  </DropdownLink>
                  <DropdownLink to="/me/history" onSelect={() => setUserMenuOpen(false)}>
                    // HISTORY
                  </DropdownLink>
                  <DropdownLink
                    to="/settings/profile"
                    onSelect={() => setUserMenuOpen(false)}
                  >
                    // SETTINGS
                  </DropdownLink>
                  {isAdmin && (
                    <DropdownLink to="/admin" onSelect={() => setUserMenuOpen(false)}>
                      // ADMIN
                    </DropdownLink>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full border-t-2 border-ink px-3 py-2 text-left text-xs uppercase text-orange hover:bg-orange hover:text-ink"
                  >
                    // LOGOUT
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <NavLink
                to="/login"
                className="border-2 border-ink px-3 py-1.5 hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink"
              >
                [ LOGIN ]
              </NavLink>
              <NavLink
                to="/register"
                className="border-2 border-ink bg-ink px-3 py-1.5 text-acid hover:bg-acid hover:text-ink"
              >
                [ REGISTER ]
              </NavLink>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(true)}
          className="flex items-center justify-center border-2 border-ink px-3 py-1.5 text-sm font-bold md:hidden"
        >
          [ ≡ ]
        </button>
      </nav>

      {menuOpen && (
        <MobileMenu
          onClose={() => setMenuOpen(false)}
          isAuthenticated={isAuthenticated}
          isCreator={isCreator}
          isAdmin={isAdmin}
          username={user?.username ?? null}
          onLogout={handleLogout}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onSearchSubmit={handleSearchSubmit}
        />
      )}
    </header>
  );
};

const navLinkClass = ({ isActive }: NavLinkRenderProps): string =>
  [
    'relative inline-block pb-2 text-sm tracking-tight transition-none',
    isActive
      ? "after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-[2px] after:h-[3px] after:bg-ink dark:after:bg-bone"
      : 'hover:text-magenta',
  ].join(' ');

interface DropdownLinkProps {
  to: string;
  children: React.ReactNode;
  onSelect: () => void;
}

const DropdownLink = ({ to, children, onSelect }: DropdownLinkProps) => (
  <Link
    role="menuitem"
    to={to}
    onClick={onSelect}
    className="block border-b-2 border-ink/15 px-3 py-2 text-xs uppercase last:border-b-0 hover:bg-acid hover:text-ink"
  >
    {children}
  </Link>
);

interface UserAvatarProps {
  avatarUrl: string | null;
  displayName: string;
}

const UserAvatar = ({ avatarUrl, displayName }: UserAvatarProps) => {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        decoding="async"
        className="h-6 w-6 border-2 border-ink object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 items-center justify-center border-2 border-ink bg-acid text-[11px] font-bold text-ink"
    >
      {initial}
    </span>
  );
};

interface MobileMenuProps {
  onClose: () => void;
  isAuthenticated: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  username: string | null;
  onLogout: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const MobileMenu = ({
  onClose,
  isAuthenticated,
  isCreator,
  isAdmin,
  username,
  onLogout,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: MobileMenuProps) => (
  <div
    id="mobile-menu"
    role="dialog"
    aria-modal="true"
    aria-label="Site navigation"
    className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bone text-ink dark:bg-ink dark:text-bone md:hidden"
  >
    <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3 font-mono">
      <span className="font-display text-2xl font-bold tracking-tight">[FRAGMENT]</span>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="border-2 border-ink px-3 py-1.5 text-sm font-bold"
      >
        [ X ]
      </button>
    </div>

    <div className="flex-1 space-y-4 px-4 py-6 font-mono">
      <form
        role="search"
        onSubmit={(event) => {
          onSearchSubmit(event);
          onClose();
        }}
        className="flex items-stretch border-2 border-ink bg-bone dark:bg-ink"
      >
        <label htmlFor="mobile-search" className="sr-only">
          Search videos
        </label>
        <input
          id="mobile-search"
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder=">> SEARCH"
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-base text-ink dark:text-bone placeholder:text-ink/40 dark:placeholder:text-bone/40 outline-none"
        />
        <button
          type="submit"
          aria-label="Run search"
          className="border-l-2 border-ink bg-ink px-3 text-acid"
        >
          [&gt;]
        </button>
      </form>

      <ul className="space-y-3 text-base uppercase">
        <li>
          <MobileLink to="/" onClose={onClose}>
            // HOME
          </MobileLink>
        </li>
        {isAuthenticated && (
          <li>
            <MobileLink to="/me/subscriptions" onClose={onClose}>
              // SUBSCRIPTIONS
            </MobileLink>
          </li>
        )}
        {isCreator && (
          <li>
            <MobileLink to="/studio" onClose={onClose}>
              // STUDIO
            </MobileLink>
          </li>
        )}
        {isCreator && (
          <li>
            <MobileLink to="/upload" onClose={onClose} accent>
              [ + UPLOAD ]
            </MobileLink>
          </li>
        )}
        {isAuthenticated ? (
          <>
            <li>
              <MobileLink to="/me" onClose={onClose}>
                // PROFILE {username ? `(${username})` : ''}
              </MobileLink>
            </li>
            <li>
              <MobileLink to="/me/history" onClose={onClose}>
                // HISTORY
              </MobileLink>
            </li>
            <li>
              <MobileLink to="/settings/profile" onClose={onClose}>
                // SETTINGS
              </MobileLink>
            </li>
            {isAdmin && (
              <li>
                <MobileLink to="/admin" onClose={onClose}>
                  // ADMIN
                </MobileLink>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={onLogout}
                className="block w-full border-2 border-ink bg-bone px-4 py-3 text-left text-orange shadow-(--shadow-brutal-sm) dark:bg-ink"
              >
                // LOGOUT
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <MobileLink to="/login" onClose={onClose}>
                [ LOGIN ]
              </MobileLink>
            </li>
            <li>
              <MobileLink to="/register" onClose={onClose} accent>
                [ REGISTER ]
              </MobileLink>
            </li>
          </>
        )}
      </ul>
    </div>

    <p className="border-t-2 border-ink bg-ink px-4 py-4 font-mono text-xs uppercase leading-relaxed text-bone">
      // FRAGMENT — RAW VIDEO. HARD EDGES. NO ALGORITHM. <br />
      &gt; A brutalist streaming statement piece.
    </p>
  </div>
);

interface MobileLinkProps {
  to: string;
  children: React.ReactNode;
  onClose: () => void;
  accent?: boolean;
}

const MobileLink = ({ to, children, onClose, accent = false }: MobileLinkProps) => (
  <Link
    to={to}
    onClick={onClose}
    className={`block border-2 border-ink px-4 py-3 shadow-(--shadow-brutal-sm) ${
      accent ? 'bg-acid text-ink' : 'bg-bone text-ink dark:bg-ink dark:text-bone'
    }`}
  >
    {children}
  </Link>
);

export default Navbar;
