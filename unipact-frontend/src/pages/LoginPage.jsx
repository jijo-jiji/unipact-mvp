import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);

      // Navigate based on role (handled by component logic or context, 
      // but here we can check the user object if login returned it, 
      // or rely on a useEffect in the page listening to 'user')
      // For simplicity, we'll assume Company for now or let the protected route handle it?
      // Actually the plan said "Handle redirection based on role".
      // login returns { user: ... }.
      // We can also let the Dashboard route redirect if role is wrong, but better here.
      // But verify login response structure in AuthContext.
      // It returns response.data which is { user: {...}, message: ... }
      // So:
      // const data = await login(email, password);
      // if (data.user.role === 'COMPANY') navigate('/company/dashboard');
      // else navigate('/student/dashboard');

      // Let's implement that.
    } catch (err) {
      console.error(err);
      setError('Access Denied: Invalid Credentials');
      setLoading(false); // Stop loading on error
      return;
    }
    // Loading state cleanup happens after navigation? No, component unmounts.
  };

  // Re-write handleSubmit properly
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.role === 'COMPANY') {
        navigate('/company/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      setError('Access Denied: Invalid Credentials');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">

      <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-tech)] p-8 relative animate-fade-in shadow-2xl">
        {/* Decorative Corners */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[var(--text-gold)]"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[var(--text-gold)]"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[var(--text-gold)]"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[var(--text-gold)]"></div>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full border border-[var(--text-gold)] bg-black/40 shadow-[var(--glow-gold)]">
              <ShieldCheck className="text-[var(--text-gold)] w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl text-white tracking-[0.2em]">SYSTEM ACCESS</h2>
          <p className="text-[var(--text-blue)] text-xs uppercase mt-2">Identify Yourself</p>

          {error && (
            <div className="mt-4 bg-red-900/20 border border-red-500/50 p-2 flex items-center justify-center gap-2 text-red-400 text-xs">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider ml-1">
              User ID / Email
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-500 group-focus-within:text-[var(--text-gold)] transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/30 border border-gray-700 text-white text-sm rounded-none py-3 pl-10 pr-3 focus:outline-none focus:border-[var(--text-gold)] focus:shadow-[0_0_10px_rgba(222,184,116,0.1)] transition-all placeholder-gray-600 font-mono"
                placeholder="hunter@guild.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[var(--text-gold)] text-xs uppercase tracking-wider ml-1">
              Security Key
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-500 group-focus-within:text-[var(--text-gold)] transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/30 border border-gray-700 text-white text-sm rounded-none py-3 pl-10 pr-3 focus:outline-none focus:border-[var(--text-gold)] focus:shadow-[0_0_10px_rgba(222,184,116,0.1)] transition-all placeholder-gray-600 font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-[var(--text-blue)]">
            <label className="flex items-center space-x-2 cursor-pointer hover:text-white">
              <input type="checkbox" className="accent-[var(--text-gold)]" />
              <span>Maintain Link</span>
            </label>
            <a href="#" className="hover:text-[var(--text-gold)] transition-colors">Lost Key?</a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[var(--text-gold)] text-black font-bold py-3 uppercase tracking-widest hover:bg-white transition-all transform active:scale-95 flex justify-center items-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Handshaking...' : 'Establish Link'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-500">
          <span>No System ID? </span>
          <a href="#" className="text-[var(--text-gold)] hover:underline tracking-wider uppercase">
            Apply for License
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;