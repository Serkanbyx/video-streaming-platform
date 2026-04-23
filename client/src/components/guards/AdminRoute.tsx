import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';
import { BrutalCard } from '../brutal/BrutalCard.js';
import { BrutalDivider } from '../brutal/BrutalDivider.js';

export const AdminRoute = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <AsciiSpinner label="Verifying session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto w-full max-w-2xl p-6 md:p-10">
        <BrutalCard accent="orange">
          <header>
            <h1 className="font-display text-3xl uppercase tracking-tight">
              // 403 // ADMIN AUTHORITY REQUIRED
            </h1>
          </header>
          <BrutalDivider label="BLOCKED" />
          <p className="font-mono text-sm">
            This control room is sealed. Your role does not carry administrative
            credentials. Server-side authorization will reject the same request.
          </p>
        </BrutalCard>
      </section>
    );
  }

  return <Outlet />;
};

export default AdminRoute;
