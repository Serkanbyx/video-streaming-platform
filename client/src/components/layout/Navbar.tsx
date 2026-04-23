import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.js';

/**
 * Minimal scaffold so layouts mount cleanly. The full brutalist navbar
 * (logo glitch, search, dropdowns, mobile sheet) lands in STEP 22.
 */
export const Navbar = () => {
  const { isAuthenticated, isCreator, isAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-bone text-ink dark:bg-ink dark:text-bone">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 font-mono uppercase">
        <Link
          to="/"
          className="font-display text-2xl tracking-tight glitch"
          aria-label="FRAGMENT — home"
        >
          [FRAGMENT]
        </Link>

        <ul className="hidden items-center gap-4 text-sm md:flex">
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
          {isAdmin && (
            <li>
              <NavLink to="/admin" className={navLinkClass}>
                // ADMIN
              </NavLink>
            </li>
          )}
        </ul>

        <div className="flex items-center gap-2 text-xs">
          {isAuthenticated ? (
            <>
              <NavLink to="/me" className={navLinkClass}>
                // ME
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="border-2 border-ink px-2 py-1 hover:bg-ink hover:text-bone dark:hover:bg-bone dark:hover:text-ink"
              >
                [ LOGOUT ]
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass}>
                [ LOGIN ]
              </NavLink>
              <NavLink to="/register" className={navLinkClass}>
                [ REGISTER ]
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `border-b-2 pb-0.5 ${isActive ? 'border-ink dark:border-bone' : 'border-transparent hover:border-acid'}`;

export default Navbar;
