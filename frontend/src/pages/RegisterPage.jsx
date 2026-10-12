import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Check } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Field, TextInput, PasswordInput } from '../components/ui/FormControls.jsx';
import { validateRegister, applyServerErrors } from '../utils/validation.js';
import { useAuth } from '../context/AuthContext.jsx';

function PasswordStrength(password) {
  // Heuristic UI feedback only; the server enforces >= 12 chars and <= 72 UTF-8 bytes.
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_META = [
  { label: 'Too short', color: 'bg-slate-200', text: 'text-slate-400' },
  { label: 'Weak', color: 'bg-red-400', text: 'text-red-500' },
  { label: 'Fair', color: 'bg-amber-400', text: 'text-amber-600' },
  { label: 'Good', color: 'bg-sky-500', text: 'text-sky-600' },
  { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' },
];

export default function RegisterPage() {
  const { register, authenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authenticated && !initializing) navigate('/dashboard', { replace: true });
  }, [authenticated, initializing, navigate]);

  const strength = useMemo(() => PasswordStrength(values.password), [values.password]);

  if (authenticated) return <Navigate to="/dashboard" replace />;

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateRegister(values);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    setSubmitting(true);
    setFormError(null);
    const result = await register(values.name, values.email, values.password);
    setSubmitting(false);
    if (result.ok) navigate('/dashboard', { replace: true });
    else {
      setErrors(applyServerErrors(result, ['name', 'email', 'password']));
      setFormError(result.status === 429 ? 'Too many registration attempts. Please wait 15 minutes.' : result.message);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50">
            <Zap size={20} className="text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">FreelanceHub</span>
        </Link>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">Start tracking revenue in minutes.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            One account for every client, project, and payment. Your data stays private — everything you create is scoped to your account on day one.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {['Free while self-hosted — your data, your server', 'Per-account isolation of all records', 'Instant dashboard after signup'].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"><Check size={12} /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} FreelanceHub · Project &amp; Income Tracker</p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <Zap size={18} className="text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">FreelanceHub</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/[0.04] sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Create your account</h2>
            <p className="mt-1 text-sm text-slate-500">No credit card, no setup — just sign up.</p>

            {formError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {formError}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
              <Field label="Full name" htmlFor="register-name" error={errors.name}>
                <TextInput id="register-name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} placeholder="Ada Lovelace" maxLength={120} />
              </Field>
              <Field label="Email" htmlFor="register-email" error={errors.email}>
                <TextInput id="register-email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" />
              </Field>
              <Field label="Password" htmlFor="register-password" error={errors.password} hint="At least 12 characters.">
                <PasswordInput id="register-password" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} placeholder="Minimum 12 characters" />
                {values.password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`h-full flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_META[strength].color : 'bg-slate-100'}`} />
                      ))}
                    </div>
                    <span className={`text-[11px] font-semibold ${STRENGTH_META[strength].text}`}>{STRENGTH_META[strength].label}</span>
                  </div>
                )}
              </Field>
              <Field label="Confirm password" htmlFor="register-confirm" error={errors.confirm}>
                <PasswordInput id="register-confirm" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} placeholder="Repeat your password" />
              </Field>
              <Button type="submit" size="lg" loading={submitting} className="w-full">
                {submitting ? 'Creating account…' : <>Create account <ArrowRight size={16} /></>}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-indigo-600 transition hover:text-indigo-700">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
