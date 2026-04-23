import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { registerSchema, type RegisterInput } from '@shared/schemas/auth.schema.js';

import { useAuth } from '../context/AuthContext.js';
import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../components/brutal/BrutalDivider.js';
import { BrutalInput } from '../components/brutal/BrutalInput.js';

// `confirmPassword` is a UX-only field — the server schema does not have it,
// so we extend the shared `RegisterInput` only on the client.
interface RegisterFormState extends RegisterInput {
  confirmPassword: string;
}

type RegisterErrors = Partial<Record<keyof RegisterFormState, string>>;

const EMPTY_FORM: RegisterFormState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof RegisterFormState>(
    key: K,
    value: RegisterFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: RegisterErrors = {};

    // 1. Server-shared validation. Same Zod schema → no shape drift.
    const parsed = registerSchema.safeParse({
      username: form.username,
      email: form.email,
      password: form.password,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof RegisterInput | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
    }

    // 2. Client-only confirm-password check (server doesn't trust this field).
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    if (!parsed.success || Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      toast.success('// ACCOUNT CREATED // WELCOME TO THE FRAGMENT');
      navigate('/', { replace: true });
    } catch {
      toast.error('// REGISTRATION FAILED');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-120 p-4 md:p-8">
      <BrutalCard accent="magenta">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">// FRAGMENT</span>
          <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            // REGISTER //
          </h1>
        </header>

        <BrutalDivider label="NEW SIGNAL" />

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting || undefined}
          className="flex flex-col gap-4 font-mono"
        >
          <BrutalInput
            label="USERNAME"
            type="text"
            prefix="@"
            value={form.username}
            onChange={(event) => updateField('username', event.target.value)}
            error={errors.username}
            hint="3-24 chars · letters, numbers, underscore"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            required
          />

          <BrutalInput
            label="EMAIL"
            type="email"
            prefix=">>"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            error={errors.email}
            autoComplete="email"
            inputMode="email"
            required
          />

          <BrutalInput
            label="PASSWORD"
            type="password"
            prefix="**"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            error={errors.password}
            hint="Min 8 chars · at least one letter and one digit"
            autoComplete="new-password"
            required
          />

          <BrutalInput
            label="CONFIRM PASSWORD"
            type="password"
            prefix="**"
            value={form.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            error={errors.confirmPassword}
            autoComplete="new-password"
            required
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs uppercase opacity-70">
              {'>>'} ALREADY ON THE GRID?{' '}
              <Link to="/login" className="underline hover:text-magenta">
                [ LOG IN ]
              </Link>
            </p>
            <BrutalButton type="submit" disabled={submitting}>
              {submitting ? 'CREATING...' : 'CREATE ACCOUNT'}
            </BrutalButton>
          </div>
        </form>
      </BrutalCard>
    </section>
  );
};

export default RegisterPage;
