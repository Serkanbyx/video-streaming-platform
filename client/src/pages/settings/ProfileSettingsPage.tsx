import { useEffect, useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';

import {
  updateProfileSchema,
  type UpdateProfileInput,
} from '@shared/schemas/user.schema.js';

import { BrutalButton } from '../../components/brutal/BrutalButton.js';
import { BrutalCard } from '../../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../../components/brutal/BrutalDivider.js';
import { BrutalInput } from '../../components/brutal/BrutalInput.js';
import { useAuth } from '../../context/AuthContext.js';
import * as authService from '../../services/auth.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';
import { resolveAssetUrl } from '../../utils/constants.js';

const BIO_MAX = 280;
const DISPLAY_NAME_MAX = 48;
const BANNER_URL_MAX = 2048;

interface ProfileFormState {
  displayName: string;
  bio: string;
  bannerUrl: string;
}

type ProfileFieldErrors = Partial<Record<keyof ProfileFormState, string>>;

const isHttpUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const buildPatch = (
  draft: ProfileFormState,
  initial: ProfileFormState
): UpdateProfileInput => {
  const patch: Record<string, string> = {};
  if (draft.displayName.trim() !== initial.displayName.trim()) {
    patch.displayName = draft.displayName.trim();
  }
  if (draft.bio.trim() !== initial.bio.trim()) {
    patch.bio = draft.bio.trim();
  }
  if (draft.bannerUrl.trim() !== initial.bannerUrl.trim()) {
    patch.bannerUrl = draft.bannerUrl.trim();
  }
  return patch as UpdateProfileInput;
};

export const ProfileSettingsPage = () => {
  const { user, updateUser } = useAuth();

  const initial = useMemo<ProfileFormState>(
    () => ({
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
      bannerUrl: user?.bannerUrl ?? '',
    }),
    [user?.displayName, user?.bio, user?.bannerUrl]
  );

  const [form, setForm] = useState<ProfileFormState>(initial);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Re-sync local draft when the auth context refreshes (e.g. after /me).
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const updateField = <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const isDirty = useMemo<boolean>(
    () => Object.keys(buildPatch(form, initial)).length > 0,
    [form, initial]
  );

  const previewSrc = isHttpUrl(form.bannerUrl)
    ? resolveAssetUrl(form.bannerUrl)
    : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!isDirty || submitting) return;

    const patch = buildPatch(form, initial);
    const parsed = updateProfileSchema.safeParse(patch);
    if (!parsed.success) {
      const next: ProfileFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ProfileFormState | undefined;
        if (field && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const data = await authService.updateProfile(parsed.data);
      updateUser(data.user);
      toast.success('// PROFILE SAVED');
    } catch (err) {
      const axiosError = err as ExtendedAxiosError;
      const message =
        axiosError.response?.data?.message ?? 'Could not save profile';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <BrutalCard accent="acid">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">
            // FRAGMENT // SETTINGS
          </span>
          <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            // PROFILE
          </h1>
          <p className="font-mono text-sm opacity-70">
            Edit how the world sees you. Username and email live in [ ACCOUNT ].
          </p>
        </header>

        <BrutalDivider label="DETAILS" />

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting || undefined}
          className="flex flex-col gap-5"
        >
          <BrutalInput
            label="DISPLAY NAME"
            prefix=">>"
            value={form.displayName}
            onChange={(event) => updateField('displayName', event.target.value)}
            error={errors.displayName}
            hint={`${form.displayName.trim().length}/${DISPLAY_NAME_MAX}`}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            required
          />

          <div className="flex flex-col gap-1 font-mono">
            <label
              htmlFor="profile-bio"
              className="text-xs uppercase tracking-tight text-ink dark:text-bone"
            >
              // BIO
            </label>

            <textarea
              id="profile-bio"
              value={form.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              maxLength={BIO_MAX}
              rows={4}
              aria-invalid={Boolean(errors.bio) || undefined}
              aria-describedby="profile-bio-counter"
              className={`min-h-30 resize-y border-2 ${
                errors.bio ? 'border-orange' : 'border-ink'
              } bg-bone px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 dark:bg-ink dark:text-bone dark:placeholder:text-bone/40 focus-within:shadow-(--shadow-brutal-sm)`}
              placeholder="// signal description --> who are you?"
            />

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink/60 dark:text-bone/60">
                {errors.bio ? `! ${errors.bio}` : 'Plain text. Markdown ignored.'}
              </span>
              <span
                id="profile-bio-counter"
                className={`tabular-nums ${
                  form.bio.length >= BIO_MAX
                    ? 'text-orange'
                    : 'text-ink/60 dark:text-bone/60'
                }`}
              >
                {form.bio.length}/{BIO_MAX}
              </span>
            </div>
          </div>

          <BrutalInput
            label="BANNER URL"
            prefix="//"
            type="url"
            inputMode="url"
            value={form.bannerUrl}
            onChange={(event) => updateField('bannerUrl', event.target.value)}
            error={errors.bannerUrl}
            hint="Optional. https://… image link displayed on your channel."
            maxLength={BANNER_URL_MAX}
            placeholder="https://example.com/banner.jpg"
            autoComplete="off"
          />

          {form.bannerUrl && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
                // PREVIEW
              </span>
              <div className="relative h-40 w-full overflow-hidden border-2 border-ink bg-ink">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-widest text-bone/60">
                    // INVALID URL // expecting http(s)
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <span className="mr-auto font-mono text-[11px] uppercase tracking-widest opacity-60">
              {isDirty ? '// UNSAVED CHANGES' : '// IN SYNC'}
            </span>
            <BrutalButton type="submit" disabled={!isDirty || submitting}>
              {submitting ? 'SAVING...' : 'SAVE PROFILE'}
            </BrutalButton>
          </div>
        </form>
      </BrutalCard>
    </section>
  );
};

export default ProfileSettingsPage;
