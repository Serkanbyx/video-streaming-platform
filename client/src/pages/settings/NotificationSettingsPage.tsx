import { useCallback } from 'react';

import type { UserPreferencesNotifications } from '@shared/types/user.js';

import { BrutalBadge } from '../../components/brutal/BrutalBadge.js';
import { BrutalCard } from '../../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../../components/brutal/BrutalDivider.js';
import { BrutalToggle } from '../../components/brutal/BrutalToggle.js';
import { useAuth } from '../../context/AuthContext.js';
import { usePreferences } from '../../context/PreferencesContext.js';

interface NotificationToggleConfig {
  key: keyof UserPreferencesNotifications;
  label: string;
  description: string;
  creatorOnly?: boolean;
}

const NOTIFICATION_TOGGLES: readonly NotificationToggleConfig[] = [
  {
    key: 'newSubscriber',
    label: 'NEW SUBSCRIBER',
    description: 'Show an indicator when someone subscribes to your channel.',
    creatorOnly: true,
  },
  {
    key: 'newComment',
    label: 'NEW COMMENT',
    description: 'Show an indicator when someone replies to or comments on your videos.',
    creatorOnly: true,
  },
];

export const NotificationSettingsPage = () => {
  const { isCreator } = useAuth();
  const { preferences, updatePreference } = usePreferences();

  const handleToggle = useCallback(
    (key: keyof UserPreferencesNotifications, value: boolean): void => {
      void updatePreference(`notifications.${key}`, value);
    },
    [updatePreference]
  );

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <BrutalCard accent="electric">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">
            // FRAGMENT // SETTINGS
          </span>
          <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            // NOTIFICATIONS
          </h1>
          <p className="font-mono text-sm opacity-70">
            Visual indicators only — no email or push transmissions in MVP.
          </p>
        </header>

        <BrutalDivider label="CHANNELS" />

        <ul className="flex flex-col gap-3">
          {NOTIFICATION_TOGGLES.map((entry) => {
            const disabled = Boolean(entry.creatorOnly) && !isCreator;
            return (
              <li
                key={entry.key}
                className="border-2 border-ink bg-bone p-3 dark:bg-ink"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <BrutalToggle
                      label={entry.label}
                      description={entry.description}
                      checked={preferences.notifications[entry.key]}
                      onChange={(next) => handleToggle(entry.key, next)}
                      disabled={disabled}
                    />
                  </div>
                  {entry.creatorOnly && (
                    <BrutalBadge tone="magenta" bracketed={false}>
                      CREATOR
                    </BrutalBadge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 border-2 border-dashed border-ink/40 p-3 font-mono text-[11px] uppercase tracking-widest opacity-70 dark:border-bone/40">
          // notifications are visual indicators only in mvp. no email, no push.
        </p>
      </BrutalCard>
    </section>
  );
};

export default NotificationSettingsPage;
