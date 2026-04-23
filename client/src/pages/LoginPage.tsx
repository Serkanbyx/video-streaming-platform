import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { loginSchema, type LoginInput } from '@shared/schemas/auth.schema.js';

import { useAuth } from '../context/AuthContext.js';
import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalCard } from '../components/brutal/BrutalCard.js';
import { BrutalDivider } from '../components/brutal/BrutalDivider.js';
import { BrutalInput } from '../components/brutal/BrutalInput.js';

type LoginErrors = Partial<Record<keyof LoginInput, string>>;

interface LocationState {
  from?: string;
}

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<LoginInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof LoginInput>(key: K, value: LoginInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Same Zod schema the server uses → no shape drift between client and API.
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: LoginErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginInput | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data);
      const redirectTo = (location.state as LocationState | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch {
      // Generic error to avoid leaking which credential failed.
      toast.error('// INVALID CREDENTIALS');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[480px] p-4 md:p-8">
      <BrutalCard accent="acid">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase opacity-60">// FRAGMENT</span>
          <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            // LOG IN //
          </h1>
        </header>

        <BrutalDivider label="AUTHENTICATE" />

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting || undefined}
          className="flex flex-col gap-4 font-mono"
        >
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
            autoComplete="current-password"
            required
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs uppercase opacity-70">
              {'>>'} NEW HERE?{' '}
              <Link to="/register" className="underline hover:text-magenta">
                [ REGISTER ]
              </Link>
            </p>
            <BrutalButton type="submit" disabled={submitting}>
              {submitting ? 'AUTHENTICATING...' : 'ENTER'}
            </BrutalButton>
          </div>
        </form>
      </BrutalCard>
    </section>
  );
};

export default LoginPage;
