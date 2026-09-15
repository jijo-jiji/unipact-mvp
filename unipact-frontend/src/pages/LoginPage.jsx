import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { homePathForRole } from '../utils/routes';
import BrandLogo from '../components/BrandLogo';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const from = location.state?.from?.pathname;
      navigate(from && from !== '/login' ? from : homePathForRole(data.user.role), { replace: true });
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
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-block mb-5" aria-label="UniPact home">
          <BrandLogo variant="stacked" className="h-28 mx-auto" />
        </Link>
        <h1 className="font-heading font-bold text-2xl text-[#0A1748] tracking-tight">
          Sign in to your workspace
        </h1>
        <p className="text-sm text-[#5B6478] mt-1">
          Access your projects, team collaborations and talent portfolio
        </p>
      </div>

      {/* Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card py-8 px-6 sm:px-10">
          {location.state?.from && !error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-[#00AEEF]/5 border border-[#00AEEF]/20 text-sm text-[#0A1748]">
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
              <label className="field-label" htmlFor="login-password">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6478] pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-[#5B6478] hover:text-[#0A1748]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-sm text-[#5B6478]">
            Don&apos;t have an account yet?{' '}
            <Link to="/register" className="inline-block py-2 font-semibold text-[#0090C6] hover:underline">
              Create an account
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-[#5B6478] flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-[#00AEEF]" />
          Your session is protected with secure HttpOnly cookies
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
