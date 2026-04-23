import { usePreferences } from '../../context/PreferencesContext.js';

/**
 * Visual layer is already produced by `html[data-scanlines="true"]::after`
 * in `index.css` (see STEP 20). This component exists so feature flags can
 * also gate it from the React tree (e.g. embedded contexts where the global
 * `<html>` attribute is undesirable). STEP 33 fleshes out the full overlay.
 */
export const ScanlineOverlay = () => {
  const { preferences } = usePreferences();
  if (!preferences.scanlines) return null;
  return null;
};

export default ScanlineOverlay;
