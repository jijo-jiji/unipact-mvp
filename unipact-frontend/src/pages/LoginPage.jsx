import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.role === 'COMPANY') {
        navigate('/company/dashboard');
      } else if (data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Invalid email or password. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-[#00AEEF] selection:text-white">

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="w-11 h-11 rounded-lg bg-[#0B1E63] text-[#00AEEF] flex items-center justify-center font-heading font-extrabold text-2xl shadow-sm">
            UP
          </div>
          <span className="font-heading font-extrabold text-2xl text-[#0A1748] tracking-tight">
            Uni<span className="text-[#00AEEF]">Pact</span>
          </span>
        </Link>
        <h2 className="font-heading font-bold text-2xl text-[#0A1748] tracking-tight">
          Sign In to Your Workspace
        </h2>
        <p className="text-xs text-[#5B6478] mt-1">
          Access your enterprise campaigns, squad collaborations, and talent portfolio
        </p>
      </div>

      {/* Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 border border-[rgba(10,23,72,0.12)] rounded-xl shadow-sm">
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2.5 text-xs">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0A1748] mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6478]">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com or student@edu.my"
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] pl-10 pr-3 py-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0A1748] mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6478]">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#F5F7FC] border border-[rgba(10,23,72,0.15)] text-[#0A1748] pl-10 pr-3 py-2.5 text-xs rounded-md focus:border-[#00AEEF] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-md bg-[#00AEEF] hover:bg-[#0090C6] text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : (
                <>Sign In to UniPact <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[rgba(10,23,72,0.08)] text-center text-xs text-[#5B6478]">
            Don\'t have an account yet?{' '}
            <Link to="/register" className="font-bold text-[#00AEEF] hover:underline">
              Create an Account
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 text-center text-[11px] text-[#5B6478] flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-[#00AEEF]" />
          Secured with HttpOnly Cookie JWT Authentication
        </div>
      </div>

    </div>
  );
};

export default LoginPage;
