import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { Footer } from './Footer.js';
import { Navbar } from './Navbar.js';

interface AdminLink {
  to: string;
  label: string;
  end?: boolean;
}

const ADMIN_LINKS: readonly AdminLink[] = [
  { to: '/admin', label: '// DASHBOARD', end: true },
  { to: '/admin/users', label: '// USERS' },
  { to: '/admin/videos', label: '// VIDEOS' },
  { to: '/admin/comments', label: '// COMMENTS' },
];

export const AdminLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => setMobileOpen((open) => !open);
  const closeSidebar = () => setMobileOpen(false);

  return (
    <>
      <Navbar />

      <div className="flex min-h-[80vh] flex-col md:flex-row">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 font-mono text-sm uppercase text-bone md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar"
        >
          <span>// ADMIN MENU</span>
          <span aria-hidden="true">{mobileOpen ? '[ X ]' : '[ ≡ ]'}</span>
        </button>

        <aside
          id="admin-sidebar"
          className={`${mobileOpen ? 'block' : 'hidden'} w-full border-r-2 border-ink bg-ink p-4 text-bone md:block md:w-[240px]`}
        >
          <p className="mb-4 font-mono text-xs uppercase opacity-60">// CONTROL ROOM</p>
          <nav className="flex flex-col gap-2">
            {ADMIN_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  [
                    'border-2 px-2 py-2 font-mono text-sm uppercase tracking-tight',
                    isActive
                      ? 'border-acid bg-acid text-ink'
                      : 'border-transparent hover:border-acid hover:text-acid',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-[var(--pad,1rem)]">
          <Outlet />
        </main>
      </div>

      <Footer />
    </>
  );
};

export default AdminLayout;
