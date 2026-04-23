import { useCallback } from 'react';

import type { UserPreferencesPrivacy } from '@shared/types/user.js';

import { BrutalCard } from '../../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../../components/brutal/BrutalDivider.js';
import { BrutalToggle } from '../../components/brutal/BrutalToggle.js';
import { usePreferences } from '../../context/PreferencesContext.js';

interface PrivacyToggleConfig {
  key: keyof UserPreferencesPrivacy;
  label: string;
  description: string;
}

const PRIVACY_TOGGLES: readonly PrivacyToggleConfig[] = [
  {
    key: 'showEmail',
    label: 'SHOW EMAIL ON CHANNEL',
    description:
      'Other users will see your email on your public channel page. Off by default.',
  },
  {
    key: 'showHistory',
    label: 'PUBLIC WATCH HISTORY',
    description:
      'When on, your watch history is exposed on your public profile. We keep this off unless you really want it.',
  },
  {
    key: 'showSubscriptions',
    label: 'PUBLIC SUBSCRIPTIONS',
    description:
      'Lets visitors see which channels you follow on your profile.',
  },
];

export const PrivacySettingsPage = () => {
  const { preferences, updatePreference } = usePreferences();

  const handleToggle = useCallback(
    (key: keyof UserPreferencesPrivacy, value: boolean): void => {
      void updatePreference(`privacy.${key}`, value);
    },
    [updatePreference]
  );

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <BrutalCard accent="phosphor">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">
            // FRAGMENT // SETTINGS
          </span>
          <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            // PRIVACY
          </h1>
          <p className="font-mono text-sm opacity-70">
            Control which signals leak to the public. Auto-saved on toggle.
          </p>
        </header>

        <BrutalDivider label="EXPOSURE" />

        <ul className="flex flex-col gap-3">
          {PRIVACY_TOGGLES.map((entry) => (
            <li
              key={entry.key}
              className="border-2 border-ink bg-bone p-3 dark:bg-ink"
            >
              <BrutalToggle
                label={entry.label}
                description={entry.description}
                checked={preferences.privacy[entry.key]}
                onChange={(next) => handleToggle(entry.key, next)}
              />
            </li>
          ))}
        </ul>

        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest opacity-60">
          // your videos and likes are always public. these toggles only affect
          // optional metadata on your profile page.
        </p>
      </BrutalCard>
    </section>
  );
};

export default PrivacySettingsPage;
