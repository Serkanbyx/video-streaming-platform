import { type ChangeEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Footer } from './Footer.js';
import { Navbar } from './Navbar.js';

interface SettingsLink {
  to: string;
  label: string;
}

const SETTINGS_LINKS: readonly SettingsLink[] = [
  { to: '/settings/profile', label: '// PROFILE' },
  { to: '/settings/account', label: '// ACCOUNT' },
  { to: '/settings/appearance', label: '// APPEARANCE' },
  { to: '/settings/privacy', label: '// PRIVACY' },
  { to: '/settings/notifications', label: '// NOTIFICATIONS' },
];

export const SettingsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>): void => {
    navigate(event.target.value);
  };

  return (
    <>
      <Navbar />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
        <aside className="w-full md:w-[240px]">
          <label
            htmlFor="settings-nav"
            className="mb-2 block font-mono text-xs uppercase md:hidden"
          >
            // SECTION
          </label>
          <select
            id="settings-nav"
            value={location.pathname}
            onChange={handleSelect}
            className="w-full border-2 border-ink bg-bone p-2 font-mono text-sm uppercase text-ink dark:bg-ink dark:text-bone md:hidden"
          >
            {SETTINGS_LINKS.map(({ to, label }) => (
              <option key={to} value={to}>
                {label}
              </option>
            ))}
          </select>

          <nav className="hidden flex-col gap-1 border-2 border-ink p-2 md:flex">
            {SETTINGS_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'border-2 px-2 py-2 font-mono text-sm uppercase tracking-tight',
                    isActive
                      ? 'border-ink bg-acid text-ink'
                      : 'border-transparent hover:border-ink',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-h-[60vh] flex-1">
          <Outlet />
        </main>
      </div>

      <Footer />
    </>
  );
};

export default SettingsLayout;
