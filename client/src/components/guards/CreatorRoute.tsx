import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';
import { BrutalButton } from '../brutal/BrutalButton.js';
import { BrutalCard } from '../brutal/BrutalCard.js';
import { BrutalDivider } from '../brutal/BrutalDivider.js';

export const CreatorRoute = () => {
  const { isAuthenticated, isCreator, loading, becomeCreator } = useAuth();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

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

  if (isCreator) return <Outlet />;

  const handleUpgrade = async () => {
    try {
      setSubmitting(true);
      await becomeCreator();
      toast.success('// CREATOR ACCESS GRANTED');
    } catch {
      toast.error('// UPGRADE FAILED — TRY AGAIN');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <BrutalCard accent="magenta">
        <header>
          <h1 className="font-display text-3xl uppercase tracking-tight">
            // CREATOR ACCESS REQUIRED
          </h1>
        </header>
        <BrutalDivider label="UPGRADE" />
        <p className="font-mono text-sm">
          This route is reserved for creators. Flip your account to creator mode to
          publish videos, manage your studio, and watch your stats fragment in real time.
        </p>
        <div className="mt-6 flex justify-end">
          <BrutalButton
            variant="solid"
            onClick={handleUpgrade}
            disabled={submitting}
          >
            {submitting ? 'UPGRADING' : 'BECOME A CREATOR'}
          </BrutalButton>
        </div>
      </BrutalCard>
    </section>
  );
};

export default CreatorRoute;
