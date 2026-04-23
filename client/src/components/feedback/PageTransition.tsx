import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { usePreferences } from '../../context/PreferencesContext.js';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Remounts on every route change so the `fragment-page-enter` keyframe
 * replays — a brutalist 100ms opacity flick. Honours the user's motion
 * preference: when set to `off` or `reduced`, the wrapper drops the
 * animation class so the page swap is instant.
 */
export const PageTransition = ({ children, className = '' }: PageTransitionProps) => {
  const location = useLocation();
  const { preferences } = usePreferences();

  const motionEnabled = preferences.animations === 'full';
  const animationClass = motionEnabled ? 'fragment-page-enter' : '';

  return (
    <div key={location.pathname} className={`${animationClass} ${className}`}>
      {children}
    </div>
  );
};

export default PageTransition;
