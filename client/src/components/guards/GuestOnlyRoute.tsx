import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';

export const GuestOnlyRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <AsciiSpinner label="Verifying session" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default GuestOnlyRoute;
