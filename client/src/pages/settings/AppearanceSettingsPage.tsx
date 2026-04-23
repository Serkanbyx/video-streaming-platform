import { useCallback } from 'react';

import {
  PREFERENCE_ACCENTS,
  PREFERENCE_ANIMATIONS,
  PREFERENCE_DENSITIES,
  PREFERENCE_FONT_SIZES,
  PREFERENCE_THEMES,
  type PreferenceAccent,
  type PreferenceAnimation,
  type PreferenceDensity,
  type PreferenceFontSize,
  type PreferenceTheme,
} from '@shared/constants/enums.js';
import type { UserPreferences } from '@shared/types/user.js';

import { BrutalBadge } from '../../components/brutal/BrutalBadge.js';
import { BrutalButton } from '../../components/brutal/BrutalButton.js';
import { BrutalCard } from '../../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../../components/brutal/BrutalDivider.js';
import {
  BrutalSegmented,
  type BrutalSegmentedOption,
} from '../../components/brutal/BrutalSegmented.js';
import { BrutalToggle } from '../../components/brutal/BrutalToggle.js';
import { useAuth } from '../../context/AuthContext.js';
import { usePreferences } from '../../context/PreferencesContext.js';

const THEME_OPTIONS: readonly BrutalSegmentedOption<PreferenceTheme>[] =
  PREFERENCE_THEMES.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));

const FONT_SIZE_OPTIONS: readonly BrutalSegmentedOption<PreferenceFontSize>[] =
  PREFERENCE_FONT_SIZES.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));

const DENSITY_OPTIONS: readonly BrutalSegmentedOption<PreferenceDensity>[] =
  PREFERENCE_DENSITIES.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));

const ANIMATION_OPTIONS: readonly BrutalSegmentedOption<PreferenceAnimation>[] =
  PREFERENCE_ANIMATIONS.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));

const ACCENT_SWATCH: Record<PreferenceAccent, string> = {
  acid: 'bg-acid',
  magenta: 'bg-magenta',
  electric: 'bg-electric',
  orange: 'bg-orange',
};

const ACCENT_OPTIONS: readonly BrutalSegmentedOption<PreferenceAccent>[] =
  PREFERENCE_ACCENTS.map((value) => ({
    value,
    label: value.toUpperCase(),
    swatch: (
      <span
        className={`inline-block h-3 w-3 border-2 border-ink ${ACCENT_SWATCH[value]}`}
      />
    ),
  }));

export const AppearanceSettingsPage = () => {
  const { isAuthenticated } = useAuth();
  const { preferences, defaults, updatePreference, resetPreferences } =
    usePreferences();

  // Wrap the generic `updatePreference` so each call below stays type-safe
  // (path → value pairing checked at the call site).
  const handle = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void => {
      void updatePreference(key, value);
    },
    [updatePreference]
  );

  const isDefault = JSON.stringify(preferences) === JSON.stringify(defaults);

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <BrutalCard accent="magenta">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">
            // FRAGMENT // SETTINGS
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
              // APPEARANCE
            </h1>
            {!isAuthenticated && (
              <BrutalBadge tone="electric" bracketed={false}>
                LOCAL ONLY
              </BrutalBadge>
            )}
          </div>
          <p className="font-mono text-sm opacity-70">
            {isAuthenticated
              ? 'Auto-saved to your account. Applies on every device.'
              : 'Stored on this device. Sign in to sync across browsers.'}
          </p>
        </header>

        <BrutalDivider label="THEME" />

        <div className="flex flex-col gap-5">
          <BrutalSegmented
            label="MODE"
            description="System follows your OS color scheme."
            value={preferences.theme}
            options={THEME_OPTIONS}
            onChange={(next) => handle('theme', next)}
          />

          <BrutalSegmented
            label="ACCENT"
            description="Highlight color used for active states and CTAs."
            value={preferences.accentColor}
            options={ACCENT_OPTIONS}
            onChange={(next) => handle('accentColor', next)}
          />
        </div>

        <BrutalDivider label="LAYOUT" />

        <div className="flex flex-col gap-5">
          <BrutalSegmented
            label="FONT SIZE"
            value={preferences.fontSize}
            options={FONT_SIZE_OPTIONS}
            onChange={(next) => handle('fontSize', next)}
          />

          <BrutalSegmented
            label="DENSITY"
            description="Compact tightens padding for more content per screen."
            value={preferences.density}
            options={DENSITY_OPTIONS}
            onChange={(next) => handle('density', next)}
          />
        </div>

        <BrutalDivider label="MOTION" />

        <div className="flex flex-col gap-5">
          <BrutalSegmented
            label="ANIMATIONS"
            description="Reduced respects prefers-reduced-motion. Off kills all transitions."
            value={preferences.animations}
            options={ANIMATION_OPTIONS}
            onChange={(next) => handle('animations', next)}
          />

          <div className="border-2 border-ink bg-bone p-3 dark:bg-ink">
            <BrutalToggle
              label="SCANLINES"
              description="CRT-style horizontal scanline overlay across the UI."
              checked={preferences.scanlines}
              onChange={(next) => handle('scanlines', next)}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-3 dark:border-bone">
          <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
            {isDefault ? '// DEFAULTS APPLIED' : '// CUSTOMIZED'}
          </span>
          <BrutalButton
            variant="outline"
            size="sm"
            onClick={resetPreferences}
            disabled={isDefault}
          >
            RESET TO DEFAULTS
          </BrutalButton>
        </div>
      </BrutalCard>
    </section>
  );
};

export default AppearanceSettingsPage;
