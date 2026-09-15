import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { homePathForRole } from '../utils/routes';
import AuthShell from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import { usePageTitle } from '../hooks/usePageTitle';

const LoginPage = () => {
  usePageTitle('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();

  // Already signed in: skip the form (but not mid-login, where handleLogin does the redirect)
  if (user && !loading) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      // Return to the page they originally tried to open, if any
      const from = location.state?.from;
      const fromPath = from ? `${from.pathname}${from.search || ''}` : null;
      navigate(fromPath && from.pathname !== '/login' ? fromPath : homePathForRole(data.user.role), { replace: true });
    } catch (err) {
      setError(
        err.response?.status === 401
          ? 'That email and password combination is not correct. Please try again.'
          : getErrorMessage(err, 'Sign in failed. Please try again.')
      );
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to your workspace"
      subtitle="Access your projects, team collaborations and talent portfolio"
      footer={
        <span className="text-xs">
          By signing in you agree to our <Link to="/terms" className="underline hover:text-[#0A1748]">Terms</Link> and{' '}
          <Link to="/privacy" className="underline hover:text-[#0A1748]">Privacy Policy</Link>.
        </span>
      }
    >
      {location.state?.from && !error && (
        <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-[#00AEEF]/5 border border-[#00AEEF]/20 text-sm">
          <Lock size={16} className="shrink-0 mt-0.5 text-[#00AEEF]" />
          Please sign in to continue.
        </div>
      )}

      {error && (
        <div className="alert-error mb-5" role="alert">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="login-email">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478] pointer-events-none" />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password" />
          <div className="flex justify-end">
            <Link to="/forgot-password" state={{ email }} className="inline-block py-2 text-sm font-medium text-[#0090C6] hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-sm text-[#5B6478]">
        Don&apos;t have an account yet?{' '}
        <Link to="/register" className="inline-block py-2 font-semibold text-[#0090C6] hover:underline">
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
};

export default LoginPage;
