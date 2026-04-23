import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  changePasswordSchema,
  deleteAccountSchema,
  type ChangePasswordInput,
} from '@shared/schemas/auth.schema.js';

import { BrutalBadge } from '../../components/brutal/BrutalBadge.js';
import { BrutalButton } from '../../components/brutal/BrutalButton.js';
import { BrutalCard } from '../../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../../components/brutal/BrutalDivider.js';
import { BrutalInput } from '../../components/brutal/BrutalInput.js';
import { BrutalModal } from '../../components/brutal/BrutalModal.js';
import { useAuth } from '../../context/AuthContext.js';
import * as authService from '../../services/auth.service.js';
import type { ExtendedAxiosError } from '../../api/axios.js';

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type PasswordFieldErrors = Partial<
  Record<keyof PasswordFormState | 'confirmPassword', string>
>;

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export const AccountSettingsPage = () => {
  const { user, becomeCreator, logout } = useAuth();
  const navigate = useNavigate();

  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({});
  const [passwordSubmitting, setPasswordSubmitting] = useState<boolean>(false);

  const [becomePending, setBecomePending] = useState<boolean>(false);

  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState<boolean>(false);

  const updatePasswordField = <K extends keyof PasswordFormState>(
    key: K,
    value: PasswordFormState[K]
  ): void => {
    setPasswordForm((current) => ({ ...current, [key]: value }));
    if (passwordErrors[key]) {
      setPasswordErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const handlePasswordSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    if (passwordSubmitting) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    const candidate: ChangePasswordInput = {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    };

    const parsed = changePasswordSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: PasswordFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof PasswordFormState | undefined;
        if (field && !next[field]) next[field] = issue.message;
      }
      setPasswordErrors(next);
      return;
    }

    setPasswordSubmitting(true);
    try {
      await authService.changePassword(parsed.data);
      toast.success('// PASSWORD ROTATED');
      setPasswordForm(EMPTY_PASSWORD_FORM);
    } catch (err) {
      const axiosError = err as ExtendedAxiosError;
      const message =
        axiosError.response?.data?.message ?? 'Could not change password';
      setPasswordErrors({ currentPassword: message });
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleBecomeCreator = useCallback(async () => {
    if (becomePending) return;
    setBecomePending(true);
    try {
      await becomeCreator();
      toast.success('// CREATOR ACCESS GRANTED');
      navigate('/upload');
    } catch (err) {
      const axiosError = err as ExtendedAxiosError;
      const message =
        axiosError.response?.data?.message ?? 'Could not upgrade your account';
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setBecomePending(false);
    }
  }, [becomeCreator, becomePending, navigate]);

  const closeDeleteModal = useCallback(() => {
    if (deletePending) return;
    setDeleteOpen(false);
    setDeletePassword('');
    setDeleteError(null);
  }, [deletePending]);

  const handleDelete = async (): Promise<void> => {
    const parsed = deleteAccountSchema.safeParse({ password: deletePassword });
    if (!parsed.success) {
      setDeleteError(parsed.error.issues[0]?.message ?? 'Password is required');
      return;
    }

    setDeletePending(true);
    setDeleteError(null);
    try {
      await authService.deleteAccount(parsed.data);
      toast.success('// ACCOUNT WIPED');
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      const axiosError = err as ExtendedAxiosError;
      const message =
        axiosError.response?.data?.message ?? 'Could not delete account';
      setDeleteError(message);
      toast.error(`// ${message.toUpperCase()}`);
    } finally {
      setDeletePending(false);
    }
  };

  if (!user) return null;

  const isViewer = user.role === 'viewer';

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <BrutalCard accent="electric">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">
            // FRAGMENT // SETTINGS
          </span>
          <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            // ACCOUNT
          </h1>
          <p className="font-mono text-sm opacity-70">
            Identity, credentials, and account lifecycle.
          </p>
        </header>

        <BrutalDivider label="IDENTITY" />

        <dl className="grid grid-cols-1 gap-3 font-mono text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1 border-2 border-ink bg-bone p-3 dark:bg-ink">
            <dt className="flex items-center justify-between text-[11px] uppercase tracking-widest opacity-60">
              <span>// USERNAME</span>
              <BrutalBadge tone="orange" bracketed={false}>
                LOCKED
              </BrutalBadge>
            </dt>
            <dd className="break-all text-base">@{user.username}</dd>
          </div>

          <div className="flex flex-col gap-1 border-2 border-ink bg-bone p-3 dark:bg-ink">
            <dt className="flex items-center justify-between text-[11px] uppercase tracking-widest opacity-60">
              <span>// EMAIL</span>
              <BrutalBadge tone="orange" bracketed={false}>
                LOCKED
              </BrutalBadge>
            </dt>
            <dd className="break-all text-base">{user.email}</dd>
          </div>

          <div className="flex flex-col gap-1 border-2 border-ink bg-bone p-3 dark:bg-ink">
            <dt className="text-[11px] uppercase tracking-widest opacity-60">// ROLE</dt>
            <dd className="text-base uppercase">{user.role}</dd>
          </div>

          <div className="flex flex-col gap-1 border-2 border-ink bg-bone p-3 dark:bg-ink">
            <dt className="text-[11px] uppercase tracking-widest opacity-60">// USER ID</dt>
            <dd className="break-all text-[11px] opacity-70">{user._id}</dd>
          </div>
        </dl>

        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest opacity-60">
          // username + email cannot be changed via the api in mvp.
        </p>
      </BrutalCard>

      <BrutalCard accent="acid">
        <header className="flex flex-col gap-1">
          <h2 className="font-display text-2xl uppercase tracking-tight">
            // CHANGE PASSWORD
          </h2>
          <p className="font-mono text-sm opacity-70">
            Rotate your credentials. Min 8 chars, mix letters and numbers.
          </p>
        </header>

        <BrutalDivider label="CREDENTIALS" />

        <form
          onSubmit={handlePasswordSubmit}
          noValidate
          aria-busy={passwordSubmitting || undefined}
          className="flex flex-col gap-4"
        >
          <BrutalInput
            label="CURRENT PASSWORD"
            type="password"
            prefix="**"
            value={passwordForm.currentPassword}
            onChange={(event) =>
              updatePasswordField('currentPassword', event.target.value)
            }
            error={passwordErrors.currentPassword}
            autoComplete="current-password"
            required
          />

          <BrutalInput
            label="NEW PASSWORD"
            type="password"
            prefix=">>"
            value={passwordForm.newPassword}
            onChange={(event) =>
              updatePasswordField('newPassword', event.target.value)
            }
            error={passwordErrors.newPassword}
            autoComplete="new-password"
            required
          />

          <BrutalInput
            label="CONFIRM NEW PASSWORD"
            type="password"
            prefix=">>"
            value={passwordForm.confirmPassword}
            onChange={(event) =>
              updatePasswordField('confirmPassword', event.target.value)
            }
            error={passwordErrors.confirmPassword}
            autoComplete="new-password"
            required
          />

          <div className="mt-1 flex justify-end">
            <BrutalButton type="submit" disabled={passwordSubmitting}>
              {passwordSubmitting ? 'ROTATING...' : 'CHANGE PASSWORD'}
            </BrutalButton>
          </div>
        </form>
      </BrutalCard>

      {isViewer && (
        <BrutalCard
          accent="magenta"
          className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
              // UPGRADE // GET UPLOAD ACCESS
            </span>
            <h2 className="font-display text-2xl uppercase tracking-tight md:text-3xl">
              BECOME A CREATOR
            </h2>
            <p className="font-mono text-sm opacity-80">
              Unlock uploads, the studio dashboard, and analytics for your channel.
            </p>
          </div>
          <BrutalButton onClick={handleBecomeCreator} disabled={becomePending}>
            {becomePending ? 'UPGRADING...' : 'BECOME CREATOR'}
          </BrutalButton>
        </BrutalCard>
      )}

      <BrutalCard
        accent="orange"
        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-widest opacity-60">
            // DANGER ZONE
          </span>
          <h2 className="font-display text-2xl uppercase tracking-tight md:text-3xl">
            DELETE ACCOUNT
          </h2>
          <p className="font-mono text-sm opacity-80">
            Permanently wipes your account, uploads, comments, likes, and history.
            This cannot be undone.
          </p>
        </div>
        <BrutalButton variant="danger" onClick={() => setDeleteOpen(true)}>
          DELETE ACCOUNT
        </BrutalButton>
      </BrutalCard>

      <BrutalModal
        open={deleteOpen}
        onClose={closeDeleteModal}
        title="CONFIRM DELETION"
        size="md"
        footer={
          <>
            <BrutalButton
              variant="outline"
              size="sm"
              onClick={closeDeleteModal}
              disabled={deletePending}
            >
              CANCEL
            </BrutalButton>
            <BrutalButton
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={deletePending || deletePassword.length === 0}
            >
              {deletePending ? 'WIPING...' : 'DELETE FOREVER'}
            </BrutalButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            // PERMANENT DELETION // confirm with your password to proceed.
          </p>
          <p className="text-xs uppercase tracking-widest text-orange">
            ! videos, comments, history, subscriptions — all gone.
          </p>
          <BrutalInput
            label="PASSWORD"
            type="password"
            prefix="**"
            value={deletePassword}
            onChange={(event) => {
              setDeletePassword(event.target.value);
              if (deleteError) setDeleteError(null);
            }}
            error={deleteError ?? undefined}
            autoComplete="current-password"
            autoFocus
          />
        </div>
      </BrutalModal>
    </section>
  );
};

export default AccountSettingsPage;
