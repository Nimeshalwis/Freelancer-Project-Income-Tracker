import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { Field, TextInput, PasswordInput } from '../components/ui/FormControls.jsx';
import { validateLogin, applyServerErrors } from '../utils/validation.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, authenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authenticated && !initializing) navigate('/dashboard', { replace: true });
  }, [authenticated, initializing, navigate]);

  if (authenticated) return <Navigate to="/dashboard" replace />;

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateLogin(values);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    setSubmitting(true);
    setFormError(null);
    const result = await login(values.email, values.password);
    setSubmitting(false);
    if (result.ok) navigate('/dashboard', { replace: true });
    else {
      setErrors(applyServerErrors(result, ['email', 'password']));
      setFormError(result.message);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-violet-600/25 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50">
            <Zap size={20} className="text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">FreelanceHub</span>
        </Link>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Run your freelance business like a <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">SaaS</span>.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Track clients, projects, and payments in one place. See your income, monitor outstanding balances, and stay on top of your business.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {['Dashboard KPIs & monthly income charts', 'Client, project & payment management', 'Balance-safe payment recording'].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} FreelanceHub · Project &amp; Income Tracker</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <Zap size={18} className="text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">FreelanceHub</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/[0.04] sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to your workspace.</p>

            {formError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {formError}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
              <Field label="Email" htmlFor="login-email" error={errors.email}>
                <TextInput id="login-email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} placeholder="you@example.com" />
              </Field>
              <Field label="Password" htmlFor="login-password" error={errors.password}>
                <PasswordInput id="login-password" autoComplete="current-password" value={values.password} onChange={set('password')} error={errors.password} placeholder="Your password" />
              </Field>
              <Button type="submit" size="lg" loading={submitting} className="w-full">
                {submitting ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              New here?{' '}
              <Link to="/register" className="font-semibold text-indigo-600 transition hover:text-indigo-700">Create an account</Link>
            </p>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <Loader2 size={12} className="hidden" />
            Secure sign-in to your account
          </p>
        </div>
      </div>
    </div>
  );
}
